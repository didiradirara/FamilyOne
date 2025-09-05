import 'package:flutter/material.dart';
import '../api/client.dart';
import 'report_detail.dart';
import '../api/session.dart';
import '../realtime/realtime.dart';

class ReportScreen extends StatefulWidget {
  const ReportScreen({super.key});
  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  final ApiClient api = ApiClient();
  final TextEditingController msgCtrl = TextEditingController();
  List<dynamic> items = [];
  final TextEditingController qCtrl = TextEditingController();
  String typeFilter = 'all';
  String statusFilter = 'all';
  final TextEditingController fromCtrl = TextEditingController();
  final TextEditingController toCtrl = TextEditingController();
  List<Map<String, dynamic>> teams = [];
  String selectedTeam = 'all';
  String selectedDetail = 'all';
  bool _firstLoad = true;

  Future<void> load() async {
    String path = '/api/reports';
    if (_firstLoad) {
      final qs = <String>[];
      if ((ApiSession.site ?? '').isNotEmpty) {
        qs.add('site=${Uri.encodeQueryComponent(ApiSession.site!)}');
      }
      if ((ApiSession.team ?? '').isNotEmpty) {
        qs.add('team=${Uri.encodeQueryComponent(ApiSession.team!)}');
      }
      if ((ApiSession.teamDetail ?? '').isNotEmpty) {
        qs.add('teamDetail=${Uri.encodeQueryComponent(ApiSession.teamDetail!)}');
      }
      if (qs.isNotEmpty) path = '$path?${qs.join('&')}';
    }
    items = await api.get(path);
    _firstLoad = false;
    if (mounted) setState(() {});
  }

  Future<void> loadTeams() async {
    try {
      final site = ApiSession.site;
      final res = await api.get(
          '/api/org/teams${(site ?? '').isNotEmpty ? '?site=' + site! : ''}');
      final list = (res as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      teams = list;
      // Defaults from logged-in user on first load
      if (selectedTeam == 'all' && (ApiSession.team ?? '').isNotEmpty &&
          list.any((t) => t['team'] == ApiSession.team)) {
        selectedTeam = ApiSession.team!;
      }
      if (selectedTeam != 'all' && (ApiSession.teamDetail ?? '').isNotEmpty) {
        final details = (list.firstWhere((t) => t['team'] == selectedTeam, orElse: () => {})['details'] as List?)?.cast<String>() ?? [];
        if (details.contains(ApiSession.teamDetail)) selectedDetail = ApiSession.teamDetail!;
      }
      if (mounted) setState(() {});
    } catch (_) {}
  }

  Future<void> submit() async {
    try {
      await api.post('/api/reports', {
        'type': 'machine_fault',
        'message': msgCtrl.text,
      });
      if (!mounted) return;
      msgCtrl.clear();
      await load();
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('보고 완료')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('실패: $e')));
    }
  }

  Future<void> setStatus(String id, String status) async {
    try {
      await api.patch('/api/reports/' + id, {'status': status});
      await load();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('실패: $e')));
    }
  }

  @override
  void initState() {
    super.initState();
    load();
    loadTeams();
    try {
      RealtimeStore.I.clear('reports');
    } catch (_) {}
  }

  DateTime _safeParseDate(String s, {DateTime? fallback}) {
    final d = DateTime.tryParse(s);
    return d ?? (fallback ?? DateTime.now());
  }

  Future<void> _pickFrom() async {
    final init = fromCtrl.text.trim().isNotEmpty
        ? _safeParseDate(fromCtrl.text.trim())
        : DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: init,
      firstDate: DateTime(2020, 1, 1),
      lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
    );
    if (picked != null) {
      fromCtrl.text = picked.toIso8601String().substring(0, 10);
      setState(() {});
    }
  }

  Future<void> _pickTo() async {
    final init = toCtrl.text.trim().isNotEmpty
        ? _safeParseDate(toCtrl.text.trim())
        : DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: init,
      firstDate: DateTime(2020, 1, 1),
      lastDate: DateTime.now().add(const Duration(days: 365 * 3)),
    );
    if (picked != null) {
      toCtrl.text = picked.toIso8601String().substring(0, 10);
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('보고 작성',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        // UUID 입력 제거: 로그인 사용자로 자동 처리
        TextField(
            controller: msgCtrl,
            decoration: const InputDecoration(
                border: OutlineInputBorder(), hintText: '메시지')),
        const SizedBox(height: 8),
        ElevatedButton(onPressed: submit, child: const Text('제출')),
        const Divider(),
        const Text('보고 목록'),
        const SizedBox(height: 8),
        TextField(
            controller: qCtrl,
            decoration: const InputDecoration(
                border: OutlineInputBorder(), hintText: '검색(메시지/종류/상태)')),
        const SizedBox(height: 8),
        Row(children: [
          DropdownButton<String>(
              value: typeFilter,
              items: const [
                DropdownMenuItem(value: 'all', child: Text('전체 종류')),
                DropdownMenuItem(value: 'machine_fault', child: Text('설비고장')),
                DropdownMenuItem(
                    value: 'material_shortage', child: Text('자재부족')),
                DropdownMenuItem(value: 'defect', child: Text('불량')),
                DropdownMenuItem(value: 'other', child: Text('기타')),
              ],
              onChanged: (v) {
                setState(() => typeFilter = v ?? 'all');
              }),
          const SizedBox(width: 8),
          DropdownButton<String>(
              value: statusFilter,
              items: const [
                DropdownMenuItem(value: 'all', child: Text('전체 상태')),
                DropdownMenuItem(value: 'new', child: Text('신규')),
                DropdownMenuItem(value: 'ack', child: Text('접수')),
                DropdownMenuItem(value: 'resolved', child: Text('해결')),
              ],
              onChanged: (v) {
                setState(() => statusFilter = v ?? 'all');
              }),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(
              child: TextField(
                  controller: fromCtrl,
                  readOnly: true,
                  onTap: _pickFrom,
                  decoration: InputDecoration(
                      border: const OutlineInputBorder(),
                      hintText: 'From YYYY-MM-DD',
                      suffixIcon: IconButton(icon: const Icon(Icons.date_range), onPressed: _pickFrom)))),
          const SizedBox(width: 8),
          Expanded(
              child: TextField(
                  controller: toCtrl,
                  readOnly: true,
                  onTap: _pickTo,
                  decoration: InputDecoration(
                      border: const OutlineInputBorder(),
                      hintText: 'To YYYY-MM-DD',
                      suffixIcon: IconButton(icon: const Icon(Icons.date_range), onPressed: _pickTo)))),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          DropdownButton<String>(
              value: selectedTeam,
              items: [
                const DropdownMenuItem(value: 'all', child: Text('전체 팀')),
                ...teams.map((t) => DropdownMenuItem(
                    value: t['team'] as String,
                    child: Text(t['team'] as String)))
              ],
              onChanged: (v) {
                setState(() {
                  selectedTeam = v ?? 'all';
                  selectedDetail = 'all';
                });
              }),
          const SizedBox(width: 8),
          DropdownButton<String>(
              value: selectedDetail,
              items: [
                const DropdownMenuItem(value: 'all', child: Text('전체 세부담당')),
                ...((teams.firstWhere((t) => t['team'] == selectedTeam,
                            orElse: () => {})['details'] as List?) ??
                        [])
                    .map((d) => DropdownMenuItem(
                        value: d as String, child: Text(d as String)))
              ],
              onChanged: (v) {
                setState(() => selectedDetail = v ?? 'all');
              }),
        ]),
        const SizedBox(height: 8),
        Expanded(
            child: ListView.builder(
                itemCount: items.where((it) {
                  final s = '${it['message']} ${it['type']} ${it['status']}'
                      .toString()
                      .toLowerCase();
                  final okQ = qCtrl.text.trim().isEmpty ||
                      s.contains(qCtrl.text.trim().toLowerCase());
                  final okT = typeFilter == 'all' || it['type'] == typeFilter;
                  final okS =
                      statusFilter == 'all' || it['status'] == statusFilter;
                  final okFrom = fromCtrl.text.trim().isEmpty ||
                      DateTime.tryParse(it['createdAt'] ?? '') != null &&
                          DateTime.parse(it['createdAt']).isAfter(
                              DateTime.parse(fromCtrl.text.trim())
                                  .subtract(const Duration(seconds: 1)));
                  final okTo = toCtrl.text.trim().isEmpty ||
                      DateTime.tryParse(it['createdAt'] ?? '') != null &&
                          DateTime.parse(it['createdAt']).isBefore(
                              DateTime.parse(toCtrl.text.trim())
                                  .add(const Duration(days: 1)));
                  final okTeam = selectedTeam == 'all' ||
                      (it['team'] ?? '') == selectedTeam;
                  final okDetail = selectedDetail == 'all' ||
                      (it['teamDetail'] ?? '') == selectedDetail;
                  return okQ &&
                      okT &&
                      okS &&
                      okFrom &&
                      okTo &&
                      okTeam &&
                      okDetail;
                }).length,
                itemBuilder: (c, i) {
                  final filtered = items.where((it) {
                    final s = '${it['message']} ${it['type']} ${it['status']}'
                        .toString()
                        .toLowerCase();
                    final okQ = qCtrl.text.trim().isEmpty ||
                        s.contains(qCtrl.text.trim().toLowerCase());
                    final okT = typeFilter == 'all' || it['type'] == typeFilter;
                    final okS =
                        statusFilter == 'all' || it['status'] == statusFilter;
                    final okFrom = fromCtrl.text.trim().isEmpty ||
                        DateTime.tryParse(it['createdAt'] ?? '') != null &&
                            DateTime.parse(it['createdAt']).isAfter(
                                DateTime.parse(fromCtrl.text.trim())
                                    .subtract(const Duration(seconds: 1)));
                    final okTo = toCtrl.text.trim().isEmpty ||
                        DateTime.tryParse(it['createdAt'] ?? '') != null &&
                            DateTime.parse(it['createdAt']).isBefore(
                                DateTime.parse(toCtrl.text.trim())
                                    .add(const Duration(days: 1)));
                    final okTeam = selectedTeam == 'all' ||
                        (it['team'] ?? '') == selectedTeam;
                    final okDetail = selectedDetail == 'all' ||
                        (it['teamDetail'] ?? '') == selectedDetail;
                    return okQ &&
                        okT &&
                        okS &&
                        okFrom &&
                        okTo &&
                        okTeam &&
                        okDetail;
                  }).toList();
                  final it = filtered[i];
                  return Card(
                      child: ListTile(
                    title: Text('[${it['status']}] ${it['type']}'),
                    subtitle: Text(it['message'] ?? ''),
                    onTap: () {
                      Navigator.of(context)
                          .push(MaterialPageRoute(
                              builder: (_) =>
                                  ReportDetailScreen(id: it['id'] as String)))
                          .then((_) => load());
                    },
                    trailing: (ApiSession.role == 'manager' ||
                            ApiSession.role == 'admin')
                        ? Wrap(spacing: 8, children: [
                            IconButton(
                                icon: const Icon(Icons.how_to_vote),
                                tooltip: '확인',
                                onPressed: () => setStatus(it['id'], 'ack')),
                            IconButton(
                                icon: const Icon(Icons.done_all),
                                tooltip: '해결',
                                onPressed: () =>
                                    setStatus(it['id'], 'resolved')),
                          ])
                        : null,
                  ));
                }))
      ]),
    );
  }
}
