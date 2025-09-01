import 'package:flutter/material.dart';
import '../api/client.dart';

class ReportScreen extends StatefulWidget { const ReportScreen({super.key}); @override State<ReportScreen> createState()=>_ReportScreenState(); }
class _ReportScreenState extends State<ReportScreen> {
  final ApiClient api = ApiClient();
  final TextEditingController msgCtrl = TextEditingController();
  final TextEditingController userCtrl = TextEditingController();

  Future<void> submit() async {
    try {
      await api.post('/api/reports', {
        'type': 'machine_fault',
        'message': msgCtrl.text,
        'createdBy': userCtrl.text.isEmpty ? '00000000-0000-0000-0000-000000000000' : userCtrl.text,
      });
      if (!mounted) return; msgCtrl.clear();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('보고 완료')));
    } catch (e) { if (!mounted) return; ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('실패: $e')));}    
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('보고 작성', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        TextField(controller: userCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '작성자 userId(UUID)')),
        const SizedBox(height: 8),
        TextField(controller: msgCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '메시지')),
        const SizedBox(height: 8),
        ElevatedButton(onPressed: submit, child: const Text('제출')),
      ]),
    );
  }
}