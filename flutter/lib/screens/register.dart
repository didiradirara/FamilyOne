import 'package:flutter/material.dart';
import '../api/client.dart';
import '../api/session.dart';
import '../api/auth_store.dart';
import '../main.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final ApiClient api = ApiClient();
  final nameCtrl = TextEditingController();
  String role = 'worker';
  String site = 'jeonju';
  List<Map<String, dynamic>> teams = [];
  String? team;
  String? teamDetail;
  bool busy = false;

  Future<void> loadTeams() async {
    try {
      final res = await api.get('/api/org/teams?site=' + site);
      teams = (res as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      if (teams.isNotEmpty) team ??= teams.first['team'] as String;
      teamDetail = null;
      if (mounted) setState(() {});
    } catch (_) {}
  }

  @override
  void initState() {
    super.initState();
    loadTeams();
  }

  Future<void> submit() async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final payload = {
        'name': nameCtrl.text.trim(),
        'role': role,
        'site': site,
        'team': team ?? '',
        if ((teamDetail ?? '').isNotEmpty) 'teamDetail': teamDetail,
      };
      final res = await api.post('/api/auth/register', payload);
      ApiSession.token = res['token'] as String?;
      final user = Map<String, dynamic>.from(res['user'] as Map);
      ApiSession.userId = user['id'] as String?;
      ApiSession.userName = user['name'] as String?;
      ApiSession.role = user['role'] as String?;
      ApiSession.site = user['site'] as String?;
      ApiSession.team = user['team'] as String?;
      ApiSession.teamDetail = user['teamDetail'] as String?;
      await saveAuth(ApiSession.token ?? '', user);
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const FamilyOneApp()),
          (r) => false);
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('등록 실패: $e')));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final details = (teams.firstWhere((t) => t['team'] == team,
                orElse: () => {})['details'] as List?)
            ?.cast<String>() ??
        [];
    return Scaffold(
      appBar: AppBar(title: const Text('회원가입')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: ListView(children: [
          const Text('사용자 정보',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(
                  border: OutlineInputBorder(), hintText: '이름')),
          const SizedBox(height: 8),
          const Text('역할'),
          DropdownButton<String>(
              value: role,
              items: const [
                DropdownMenuItem(value: 'worker', child: Text('작업자')),
                DropdownMenuItem(value: 'manager', child: Text('매니저')),
                DropdownMenuItem(value: 'admin', child: Text('관리자')),
              ],
              onChanged: (v) {
                setState(() => role = v ?? 'worker');
              }),
          const SizedBox(height: 8),
          const Text('사업장'),
          DropdownButton<String>(
              value: site,
              items: const [
                DropdownMenuItem(value: 'hq', child: Text('본사')),
                DropdownMenuItem(value: 'jeonju', child: Text('전주공장')),
                DropdownMenuItem(value: 'busan', child: Text('부산공장')),
              ],
              onChanged: (v) {
                setState(() => site = v ?? 'jeonju');
                loadTeams();
              }),
          const SizedBox(height: 8),
          const Text('팀'),
          DropdownButton<String>(
              value: team,
              items: [
                for (final t in teams)
                  DropdownMenuItem(
                      value: t['team'] as String,
                      child: Text(t['team'] as String))
              ],
              onChanged: (v) {
                setState(() => team = v);
              }),
          const SizedBox(height: 8),
          const Text('세부담당(선택)'),
          DropdownButton<String?>(
              value: teamDetail,
              items: [
                const DropdownMenuItem(value: null, child: Text('선택 안함')),
                ...details
                    .map((d) => DropdownMenuItem(value: d, child: Text(d)))
              ],
              onChanged: (v) {
                setState(() => teamDetail = v);
              }),
          const SizedBox(height: 12),
          FilledButton(
              onPressed: busy ? null : submit,
              child: Text(busy ? '등록 중...' : '등록')),
        ]),
      ),
    );
  }
}
