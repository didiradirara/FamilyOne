import 'package:flutter/material.dart';
import '../api/client.dart';
import '../api/session.dart';

class ChecklistScreen extends StatefulWidget { const ChecklistScreen({super.key}); @override State<ChecklistScreen> createState()=>_ChecklistScreenState(); }
class _ChecklistScreenState extends State<ChecklistScreen> {
  final ApiClient api = ApiClient();
  List<dynamic> items = [];
  Future<void> load() async { items = await api.get('/api/checklists/templates/safety'); if (mounted) setState(() {}); }
  @override void initState(){ super.initState(); load(); }
  Future<void> submit() async {
    await api.post('/api/checklists/submit', { 'date': DateTime.now().toIso8601String().substring(0,10), 'userId': (ApiSession.userId ?? '00000000-0000-0000-0000-000000000000'), 'category': 'safety', 'items': items });
    if (!mounted) return; ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('체크 완료')));
  }
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        const Text('안전 체크리스트(데모)', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Expanded(child: ListView.builder(itemCount: items.length, itemBuilder: (c,i){ final it = items[i]; return ListTile(title: Text(it['title'] ?? '')); })),
        ElevatedButton(onPressed: submit, child: const Text('제출')),
      ]),
    );
  }
}
