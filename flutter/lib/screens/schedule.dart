import 'package:flutter/material.dart';
import '../api/client.dart';
import '../api/session.dart';

class ScheduleScreen extends StatefulWidget { const ScheduleScreen({super.key});
  @override State<ScheduleScreen> createState()=>_ScheduleScreenState(); }

class _ScheduleScreenState extends State<ScheduleScreen> {
  final ApiClient api = ApiClient();
  List<dynamic> items = [];
  bool loading = true;
  final dateCtrl = TextEditingController();
  final shiftCtrl = TextEditingController(text: 'A');

  bool get canEdit => (ApiSession.role == 'manager' || ApiSession.role == 'admin');

  Future<void> load() async { try { items = await api.get('/api/schedule'); } finally { if (mounted) setState(()=>loading=false); } }
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
        Expanded(child: ListView.builder(itemCount: items.length, itemBuilder: (c,i){ final it = items[i]; return Card(child: ListTile(
          title: Text('${it['date']} / ${it['userId']} / 조:${it['shift']}'),
          trailing: canEdit ? IconButton(onPressed: () => del(it['id'] as String), icon: const Icon(Icons.delete, color: Colors.red)) : null,
        )); }))
      ]),
    );
  }
}
