import 'package:flutter/material.dart';
import '../api/client.dart';
import '../api/session.dart';
import '../api/auth_store.dart';
import 'org_admin.dart';
import 'auth.dart';
import 'package:flutter/material.dart';
import '../api/session.dart';

class HomeScreen extends StatefulWidget { const HomeScreen({super.key}); @override State<HomeScreen> createState()=>_HomeScreenState(); }
class _HomeScreenState extends State<HomeScreen> {
  final ApiClient api = ApiClient();
  Map<String, dynamic>? weather;
  List<Map<String, dynamic>> productions = [];
  List<Map<String, dynamic>> absentees = [];
  List<Map<String, dynamic>> teams = [];
  String absTeam = 'all';

  Future<void> quickReport() async {
    try {
      if ((ApiSession.userId ?? '').isEmpty) throw Exception('로그인이 필요합니다');
      final res = await api.post('/api/reports', {
        'type': 'machine_fault',
        'message': '긴급: 설비 이상 감지',
      });
      if (!mounted) return; ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('보고 완료: ${res['id']}')));
    } catch (e) {
      if (!mounted) return; ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('실패: $e')));
    }
  }

  @override
  void initState() {
    super.initState();
    _loadWeather();
    _loadProductions();
    _loadTeams().then((_) => _loadAbsentees());
  }

  String _weekdayKo(int w) => const ['일','월','화','수','목','금','토'][w%7];
  String _fmtKDate(DateTime d) => '${d.year}년 ${d.month}월 ${d.day}일(${_weekdayKo(d.weekday)})';

  Future<void> _loadWeather() async {
    try { final w = await api.get('/api/weather') as Map<String,dynamic>; weather = w; setState((){}); } catch (_) {}
  }
  Future<void> _loadProductions() async {
    try { final list = await api.get('/api/productions/today') as List<dynamic>; productions = list.map((e)=> Map<String,dynamic>.from(e as Map)).toList(); setState((){}); } catch (_) {}
  }
  Future<void> _loadTeams() async {
    try { final site = ApiSession.site ?? ''; final list = await api.get('/api/org/teams${site.isNotEmpty?'?site='+site:''}') as List<dynamic>; teams = list.map((e)=> Map<String,dynamic>.from(e as Map)).toList(); setState((){}); } catch (_) {}
  }
  Future<void> _loadAbsentees() async {
    try {
      final site = ApiSession.site ?? '';
      final qs = <String>[]; if (site.isNotEmpty) qs.add('site='+Uri.encodeComponent(site)); if (absTeam!='all') qs.add('team='+Uri.encodeComponent(absTeam));
      final list = await api.get('/api/leave/absent-today${qs.isNotEmpty?'?'+qs.join('&'):''}') as List<dynamic>;
      absentees = list.map((e)=> Map<String,dynamic>.from(e as Map)).toList(); setState((){});
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    return Padding(
      padding: const EdgeInsets.all(16),
      child: ListView(
        children: [
          // 날짜/날씨
          Text(_fmtKDate(now), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Row(children:[
            Icon(
              weather==null? Icons.cloud_queue : ((){ final s=(weather!['icon']??'') as String; if (s=='sunny') return Icons.wb_sunny; if (s=='rainy') return Icons.umbrella; return Icons.cloud; })(),
              color: Colors.blueAccent,
            ),
            const SizedBox(width:8),
            Text('${weather?['temp']??'-'}° / ${weather?['humidity']??'-'}%', style: const TextStyle(fontSize: 16)),
            const Spacer(),
            if ((ApiSession.userName ?? '').isNotEmpty) Text('${ApiSession.userName} (${ApiSession.role ?? '-'})')
          ]),
          const SizedBox(height: 12),
          // UUID 입력 제거: 로그인 사용자로 자동 처리
          const SizedBox(height: 12),
          ElevatedButton(onPressed: quickReport, child: const Text('원클릭 보고(설비 고장)')),
          const SizedBox(height: 8),
          if (ApiSession.role == 'admin') ElevatedButton(onPressed: (){ Navigator.of(context).push(MaterialPageRoute(builder: (_) => const OrgAdminScreen())); }, child: const Text('조직 관리')),
          const SizedBox(height: 8),
          // 금일 생산제품
          const Divider(),
          const Text('금일 생산제품', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          if (productions.isEmpty) const Text('등록된 생산예정이 없습니다') else ...[
            for (final p in productions) ListTile(title: Text('${(p['line']??'')}호 라인 / ${p['name'] ?? ''}'), subtitle: Text('생산예정수량: ${p['plannedQty'] ?? '-'}'))
          ],
          const SizedBox(height: 12),
          // 금일 휴가자
          const Divider(),
          const Text('금일 휴가자', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Wrap(spacing: 8, children:[
            ChoiceChip(label: const Text('전체'), selected: absTeam=='all', onSelected: (_){ setState(()=> absTeam='all'); _loadAbsentees(); }),
            for (final t in teams) ChoiceChip(label: Text(t['team'] as String), selected: absTeam==t['team'], onSelected: (_){ setState(()=> absTeam=t['team'] as String); _loadAbsentees(); })
          ]),
          const SizedBox(height: 6),
          if (absentees.isEmpty) const Text('휴가자가 없습니다') else ...[
            for (final a in absentees) ListTile(title: Text('${a['team'] ?? ''} / ${a['userName'] ?? a['userId']} (${a['userRole'] ?? ''})'), subtitle: Text('${(a['startDate'] ?? '')}~${(a['endDate'] ?? '')}'))
          ],
          const SizedBox(height: 12),
          const Text('하단 탭에서 기능을 탐색하세요.')
        ],
      ),
    );
  }
}
