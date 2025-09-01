import 'package:flutter/material.dart';
import '../api/client.dart';

class LeaveScreen extends StatefulWidget { const LeaveScreen({super.key}); @override State<LeaveScreen> createState()=>_LeaveScreenState(); }
class _LeaveScreenState extends State<LeaveScreen> {
  final ApiClient api = ApiClient();
  final TextEditingController userCtrl = TextEditingController();
  final TextEditingController startCtrl = TextEditingController();
  final TextEditingController endCtrl = TextEditingController();
  List<dynamic> items = [];
  Future<void> load() async { items = await api.get('/api/leave-requests'); if (mounted) setState(() {}); }
  @override void initState(){ super.initState(); load(); }
  Future<void> submit() async { await api.post('/api/leave-requests', { 'userId': userCtrl.text.isEmpty ? '00000000-0000-0000-0000-000000000000' : userCtrl.text, 'startDate': startCtrl.text, 'endDate': endCtrl.text }); startCtrl.clear(); endCtrl.clear(); await load(); }
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        const Text('휴가 신청', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        TextField(controller: userCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'userId(UUID)')),
        const SizedBox(height: 8),
        TextField(controller: startCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '시작일 YYYY-MM-DD')),
        const SizedBox(height: 8),
        TextField(controller: endCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '종료일 YYYY-MM-DD')),
        const SizedBox(height: 8),
        ElevatedButton(onPressed: submit, child: const Text('신청')),
        const Divider(),
        Expanded(child: ListView.builder(itemCount: items.length, itemBuilder: (c,i){ final it = items[i]; return ListTile(title: Text('${it['userId']} / ${it['startDate']}~${it['endDate']} / ${it['state']}')); }))
      ]),
    );
  }
}