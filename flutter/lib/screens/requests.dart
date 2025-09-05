import 'package:flutter/material.dart';
import '../api/client.dart';
import '../api/session.dart';
import '../realtime/realtime.dart';

class RequestsScreen extends StatefulWidget { const RequestsScreen({super.key}); @override State<RequestsScreen> createState()=>_RequestsScreenState(); }
class _RequestsScreenState extends State<RequestsScreen> {
  final ApiClient api = ApiClient();
  final TextEditingController detailsCtrl = TextEditingController();
  final TextEditingController userCtrl = TextEditingController();
  List<dynamic> items = [];

  Future<void> load() async { items = await api.get('/api/requests'); if (mounted) setState(() {}); }
  @override void initState(){ super.initState(); load(); }
  @override void didChangeDependencies(){ super.didChangeDependencies(); try { RealtimeStore.I.clear('requests'); } catch (_) {} }

  Future<void> submit() async {
    await api.post('/api/requests', {
      'kind': 'material_add',
      'details': detailsCtrl.text,
      'createdBy': userCtrl.text.isNotEmpty ? userCtrl.text : (ApiSession.userId ?? '00000000-0000-0000-0000-000000000000'),
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
        TextField(controller: userCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '작성자 userId(UUID)')),
        const SizedBox(height: 8),
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
