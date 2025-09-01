import 'package:flutter/material.dart';
import '../api/client.dart';

class SuggestionsScreen extends StatefulWidget { const SuggestionsScreen({super.key}); @override State<SuggestionsScreen> createState()=>_SuggestionsScreenState(); }
class _SuggestionsScreenState extends State<SuggestionsScreen> {
  final ApiClient api = ApiClient();
  final TextEditingController textCtrl = TextEditingController();
  List<dynamic> items = [];
  Future<void> load() async { items = await api.get('/api/suggestions'); if (mounted) setState(() {}); }
  @override void initState(){ super.initState(); load(); }
  Future<void> submit() async { await api.post('/api/suggestions', { 'text': textCtrl.text, 'anonymous': true }); textCtrl.clear(); await load(); }
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        const Text('익명 제안함', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        TextField(controller: textCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '제안 내용')),
        const SizedBox(height: 8),
        ElevatedButton(onPressed: submit, child: const Text('등록')),
        const Divider(),
        Expanded(child: ListView.builder(itemCount: items.length, itemBuilder: (c,i){ final it = items[i]; return ListTile(title: Text(it['text'] ?? ''), subtitle: Text(it['createdAt'] ?? '')); }))
      ]),
    );
  }
}