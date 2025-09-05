import 'package:flutter/material.dart';
import '../api/client.dart';
import '../api/session.dart';
import '../realtime/realtime.dart';

class RequestsScreen extends StatefulWidget { const RequestsScreen({super.key}); @override State<RequestsScreen> createState()=>_RequestsScreenState(); }
class _RequestsScreenState extends State<RequestsScreen> {
  final ApiClient api = ApiClient();
  final TextEditingController detailsCtrl = TextEditingController();
  List<dynamic> items = [];

  Future<void> load() async { items = await api.get('/api/requests'); if (mounted) setState(() {}); }
  @override void initState(){ super.initState(); load(); }
  @override void didChangeDependencies(){ super.didChangeDependencies(); try { RealtimeStore.I.clear('requests'); } catch (_) {} }

  Future<void> submit() async {
    final uid = ApiSession.userId ?? '';
    if (uid.isEmpty) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('로그인이 필요합니다'))); return; }
    await api.post('/api/requests', {
      'kind': 'material_add',
      'details': detailsCtrl.text,
      'createdBy': uid,
    });
    detailsCtrl.clear(); await load();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        const Text('업무 요청', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        // UUID 입력 제거: 로그인 사용자로 자동 처리
        TextField(controller: detailsCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '요청 내용')),
        const SizedBox(height: 8),
        ElevatedButton(onPressed: submit, child: const Text('요청 제출')),
        const Divider(),
        Expanded(child: ListView.builder(itemCount: items.length, itemBuilder: (c,i){
          final it = items[i];
          return ListTile(title: Text('${it['kind']} - ${it['state']}'), subtitle: Text(it['details'] ?? ''));
        }))
      ]),
    );
  }
}
