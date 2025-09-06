import 'package:flutter/material.dart';
import '../api/client.dart';
import '../api/session.dart';
import 'package:table_calendar/table_calendar.dart';

class ScheduleScreen extends StatefulWidget { const ScheduleScreen({super.key});
  @override State<ScheduleScreen> createState()=>_ScheduleScreenState(); }

class _ScheduleScreenState extends State<ScheduleScreen> {
  final ApiClient api = ApiClient();
  List<dynamic> items = [];
  bool loading = true;
  final dateCtrl = TextEditingController();
  final shiftCtrl = TextEditingController(text: 'A');
  Map<String, Map<String, dynamic>> usersById = {};
  DateTime focusedDay = DateTime.now();
  DateTime? selectedDay;
  String scope = 'self'; // self|team|all (admin only sees all)

  bool get canEdit => (ApiSession.role == 'manager' || ApiSession.role == 'admin');
  bool get isAdmin => ApiSession.role == 'admin';

  Future<void> load() async {
    try {
      items = await api.get('/api/schedule');
      // Load users for team filtering if manager/admin
      if (ApiSession.role == 'manager' || ApiSession.role == 'admin') {
        final list = await api.get('/api/users?site=${ApiSession.site ?? ''}&team=${Uri.encodeComponent(ApiSession.team ?? '')}') as List<dynamic>;
        usersById = { for (final u in list.map((e)=>Map<String,dynamic>.from(e as Map))) (u['id'] as String): u };
      }
    } finally { if (mounted) setState(()=>loading=false); }
  }
  @override void initState(){ super.initState(); load(); }

  Future<void> add() async {
    try {
      final uid = ApiSession.userId ?? '';
      if (uid.isEmpty) throw Exception('로그인이 필요합니다');
      await api.post('/api/schedule', { 'date': dateCtrl.text, 'userId': uid, 'shift': shiftCtrl.text });
      dateCtrl.clear(); shiftCtrl.text = 'A'; await load();
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('실패: $e'))); }
  }

  Future<void> del(String id) async {
    try { final res = await api.deleteRaw('/api/schedule/$id'); if (res.statusCode>=200&&res.statusCode<300) await load(); else throw Exception(res.body); }
    catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('삭제 실패: $e'))); }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('근무 스케줄', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        // Scope selector
        Row(children:[
          ChoiceChip(label: const Text('본인'), selected: scope=='self', onSelected: (_){ setState(()=> scope='self'); }),
          const SizedBox(width: 8),
          if (ApiSession.role == 'manager' || ApiSession.role == 'admin')
            ChoiceChip(label: const Text('팀'), selected: scope=='team', onSelected: (_){ setState(()=> scope='team'); }),
          const SizedBox(width: 8),
          if (isAdmin)
            ChoiceChip(label: const Text('전체'), selected: scope=='all', onSelected: (_){ setState(()=> scope='all'); }),
        ]),
        const SizedBox(height: 8),
        TableCalendar(
          firstDay: DateTime.utc(2000, 1, 1),
          lastDay: DateTime.utc(2100, 12, 31),
          focusedDay: focusedDay,
          calendarFormat: CalendarFormat.month,
          selectedDayPredicate: (day) => isSameDay(selectedDay, day),
          onDaySelected: (sel, foc) { setState(() { selectedDay = sel; focusedDay = foc; }); },
          onPageChanged: (foc) { focusedDay = foc; },
          calendarBuilders: CalendarBuilders(
            markerBuilder: (context, day, events) {
              final ymd = day.toIso8601String().substring(0,10);
              Iterable<Map<String, dynamic>> filtered = items.cast<Map<String,dynamic>>().where((e)=> (e['date'] ?? '') == ymd);
              if (scope == 'self') {
                filtered = filtered.where((e)=> e['userId'] == (ApiSession.userId ?? ''));
              } else if (scope == 'team' && (ApiSession.role == 'manager' || ApiSession.role == 'admin')) {
                final teamUsers = usersById.keys.toSet();
                filtered = filtered.where((e)=> teamUsers.contains(e['userId']));
              }
              final count = filtered.length;
              if (count == 0) return null;
              return Align(
                alignment: Alignment.bottomCenter,
                child: Container(margin: const EdgeInsets.only(bottom: 4), padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1), decoration: BoxDecoration(color: Colors.blue.shade400, borderRadius: BorderRadius.circular(8)), child: Text('$count', style: const TextStyle(color: Colors.white, fontSize: 10))),
              );
            },
          ),
        ),
        const SizedBox(height: 8),
        if (selectedDay != null) ...[
          Text('선택일: ${selectedDay!.toIso8601String().substring(0,10)}', style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Expanded(child: ListView(children: _detailsFor(selectedDay!))),
        ] else Expanded(child: const SizedBox.shrink()),
        if (canEdit) ...[
          const Text('스케줄 추가'), const SizedBox(height: 4),
          Row(children: [
            ElevatedButton(onPressed: (){ final t=DateTime.now().toIso8601String().substring(0,10); dateCtrl.text=t; setState((){}); }, child: const Text('오늘')),
            const SizedBox(width: 8),
            ElevatedButton(onPressed: (){ final d=DateTime.now().add(const Duration(days:1)); dateCtrl.text=d.toIso8601String().substring(0,10); setState((){}); }, child: const Text('내일')),
          ]),
          const SizedBox(height: 4),
          TextField(controller: dateCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'YYYY-MM-DD')),
          const SizedBox(height: 4),
          // UUID 입력 제거: 로그인 사용자로 자동 처리
          TextField(controller: shiftCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '근무조 (A/B/C)')),
          const SizedBox(height: 4),
          ElevatedButton(onPressed: add, child: const Text('추가')),
          const Divider(),
        ],
        // Legacy list
        Expanded(child: ListView.builder(itemCount: items.length, itemBuilder: (c,i){ final it = items[i] as Map<String,dynamic>; return Card(child: ListTile(
          title: Text('${it['date']} / ${(usersById[it['userId']]?['name'] ?? it['userId'])} / 조:${it['shift']}'),
          trailing: canEdit ? IconButton(onPressed: () => del(it['id'] as String), icon: const Icon(Icons.delete, color: Colors.red)) : null,
        )); }))
      ]),
    );
  }

  List<Widget> _detailsFor(DateTime day) {
    final ymd = day.toIso8601String().substring(0,10);
    Iterable<Map<String, dynamic>> filtered = items.cast<Map<String,dynamic>>().where((e)=> (e['date'] ?? '') == ymd);
    if (scope == 'self') {
      filtered = filtered.where((e)=> e['userId'] == (ApiSession.userId ?? ''));
    } else if (scope == 'team' && (ApiSession.role == 'manager' || ApiSession.role == 'admin')) {
      final teamUsers = usersById.keys.toSet();
      filtered = filtered.where((e)=> teamUsers.contains(e['userId']));
    }
    final list = filtered.toList();
    list.sort((a,b)=> (a['userId'] as String).compareTo(b['userId'] as String));
    return [ for (final it in list) ListTile(title: Text('${usersById[it['userId']]?['name'] ?? it['userId']}'), trailing: Text('조: ${it['shift']}')) ];
  }
}
