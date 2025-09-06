import 'package:flutter/material.dart';
import '../api/client.dart';
import '../api/session.dart';
import 'org_admin.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ApiClient api = ApiClient();

  List<Map<String, dynamic>> productions = [];
  List<Map<String, dynamic>> absentees = [];
  List<Map<String, dynamic>> teams = [];
  String absTeam = 'all';

  Future<void> quickReport() async {
    try {
      if ((ApiSession.userId ?? '').isEmpty) {
        throw Exception('로그인이 필요합니다');
      }
      final res = await api.post('/api/reports', {
        'type': 'machine_fault',
        'message': 'Quick: machine fault',
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('보고 완료: ${res['id']}')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('오류: $e')),
      );
    }
  }

  @override
  void initState() {
    super.initState();
    _loadProductions();
    _loadTeams().then((_) => _loadAbsentees());
  }

  String _weekdayKo(int w) => const ['일', '월', '화', '수', '목', '금', '토'][w % 7];
  String _fmtKDate(DateTime d) => '${d.year}년 ${d.month}월 ${d.day}일(${_weekdayKo(d.weekday)})';

  Future<void> _loadProductions() async {
    try {
      final list = await api.get('/api/productions/today') as List<dynamic>;
      productions =
          list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      setState(() {});
    } catch (_) {}
  }

  Future<void> _loadTeams() async {
    try {
      final site = ApiSession.site ?? '';
      final list = await api.get('/api/org/teams${site.isNotEmpty ? '?site=' + site : ''}')
          as List<dynamic>;
      teams = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      setState(() {});
    } catch (_) {}
  }

  Future<void> _loadAbsentees() async {
    try {
      final site = ApiSession.site ?? '';
      final qs = <String>[];
      if (site.isNotEmpty) qs.add('site=' + Uri.encodeComponent(site));
      if (absTeam != 'all') qs.add('team=' + Uri.encodeComponent(absTeam));
      final list = await api.get(
              '/api/leave/absent-today${qs.isNotEmpty ? '?' + qs.join('&') : ''}')
          as List<dynamic>;
      absentees =
          list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      setState(() {});
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: ListView(
        children: [
          // Date header
          Text(_fmtKDate(now), style: textTheme.headlineSmall),
          const SizedBox(height: 6),
          if ((ApiSession.userName ?? '').isNotEmpty)
            Row(children: [
              Text(
                '${ApiSession.userName} (${ApiSession.role ?? '-'})',
                style: const TextStyle(fontSize: 16),
              ),
            ]),
          const SizedBox(height: 12),
          // Quick actions
          ElevatedButton(
            onPressed: quickReport,
            child: const Text('빠른 보고(테스트용)'),
          ),
          const SizedBox(height: 8),
          if (ApiSession.role == 'admin')
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const OrgAdminScreen()),
                );
              },
              child: const Text('조직 관리'),
            ),
          const SizedBox(height: 8),
          // Production summary
          const Divider(),
          Text('생산 실적요약',
              style:
                  textTheme.titleMedium?.copyWith(color: scheme.onSurface)),
          const SizedBox(height: 6),
          if (productions.isEmpty)
            const Text('표시할 데이터가 없습니다')
          else ...[
            for (final p in productions)
              ListTile(
                title: Text('${(p['line'] ?? '')}호 라인 / ${p['name'] ?? ''}'),
                subtitle: Text('계획수량: ${p['plannedQty'] ?? '-'}'),
              ),
          ],
          const SizedBox(height: 12),
          // Absentees
          const Divider(),
          Text('결근 현황',
              style:
                  textTheme.titleMedium?.copyWith(color: scheme.onSurface)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            children: [
              ChoiceChip(
                  label: const Text('전체'),
                  selected: absTeam == 'all',
                  onSelected: (_) {
                    setState(() => absTeam = 'all');
                    _loadAbsentees();
                  }),
              for (final t in teams)
                ChoiceChip(
                    label: Text(t['team'] as String),
                    selected: absTeam == t['team'],
                    onSelected: (_) {
                      setState(() => absTeam = t['team'] as String);
                      _loadAbsentees();
                    }),
            ],
          ),
          const SizedBox(height: 6),
          if (absentees.isEmpty)
            const Text('결근자가 없습니다')
          else ...[
            for (final a in absentees)
              ListTile(
                title: Text(
                    '${a['team'] ?? ''} / ${a['userName'] ?? a['userId']} (${a['userRole'] ?? ''})'),
                subtitle: Text(
                    '${(a['startDate'] ?? '')} ~ ${(a['endDate'] ?? '')}'),
              ),
          ],
          const SizedBox(height: 12),
          const Text('하단 탭에서 나머지 기능을 탐색해 보세요.')
        ],
      ),
    );
  }
}

