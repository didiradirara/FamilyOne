import 'package:flutter/material.dart';
import '../api/client.dart';
import '../api/session.dart';

class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key});
  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> {
  final ApiClient api = ApiClient();
  List<dynamic> requests = [];
  List<dynamic> leaves = [];
  bool busy = false;

  Future<void> load() async {
    try {
      final reqs = await api.get('/api/requests');
      final lrs = await api.get('/api/leave-requests');
      requests = (reqs as List).where((e) => e['state'] == 'pending').toList();
      leaves = (lrs as List).where((e) => e['state'] == 'pending').toList();
      if (mounted) setState(() {});
    } catch (_) {}
  }

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> _act(String type, String id, bool approve) async {
    if (busy) return; setState(() => busy = true);
    try {
      final reviewer = ApiSession.userId ?? '';
      if (reviewer.isEmpty) throw Exception('로그인이 필요합니다');
      final path = type == 'request'
          ? '/api/requests/$id/${approve ? 'approve' : 'reject'}'
          : '/api/leave-requests/$id/${approve ? 'approve' : 'reject'}';
      Map<String, dynamic> body = { 'reviewerId': reviewer };
      if (type == 'leave' && !approve) {
        final reason = await showDialog<String>(
          context: context,
          builder: (_) { final ctrl = TextEditingController(); return AlertDialog(title: const Text('반려 사유'), content: TextField(controller: ctrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '사유를 입력하세요')),
            actions: [ TextButton(onPressed: ()=>Navigator.pop(context), child: const Text('취소')), FilledButton(onPressed: ()=>Navigator.pop(context, ctrl.text.trim()), child: const Text('확인')) ] ); }
        );
        if (reason != null && reason.isNotEmpty) body['reason'] = reason;
      }
      await api.patch(path, body);
      await load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(approve ? '승인 완료' : '반려 완료')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('실패: $e')));
    } finally { if (mounted) setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: ListView(
        children: [
          const Text('승인 대기 - 요청', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          ...requests.map((it) => Card(
            child: ListTile(
              title: Text('${it['kind']}'),
              subtitle: Text(it['details'] ?? ''),
              trailing: Wrap(spacing: 8, children: [
                IconButton(tooltip: '반려', icon: const Icon(Icons.close, color: Colors.red), onPressed: () => _act('request', it['id'], false)),
                IconButton(tooltip: '승인', icon: const Icon(Icons.check, color: Colors.green), onPressed: () => _act('request', it['id'], true)),
              ]),
            ),
          )),
          const SizedBox(height: 16),
          const Text('승인 대기 - 휴가', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          ...leaves.map((it) => Card(
            child: ListTile(
              title: Text('${it['userId']} ${it['startDate']}~${it['endDate']}'),
              subtitle: Text((it['reason'] ?? '') + ((it['signature'] ?? '').isNotEmpty ? '\n서명: ${it['signature']}' : '')),
              trailing: Wrap(spacing: 8, children: [
                IconButton(tooltip: '반려', icon: const Icon(Icons.close, color: Colors.red), onPressed: () => _act('leave', it['id'], false)),
                IconButton(tooltip: '승인', icon: const Icon(Icons.check, color: Colors.green), onPressed: () => _act('leave', it['id'], true)),
              ]),
            ),
          )),
        ],
      ),
    );
  }
}

