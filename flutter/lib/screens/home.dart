import 'package:flutter/material.dart';
import '../api/client.dart';

class HomeScreen extends StatefulWidget { const HomeScreen({super.key}); @override State<HomeScreen> createState()=>_HomeScreenState(); }
class _HomeScreenState extends State<HomeScreen> {
  final ApiClient api = ApiClient();
  final TextEditingController userCtrl = TextEditingController();

  Future<void> quickReport() async {
    try {
      final res = await api.post('/api/reports', {
        'type': 'machine_fault',
        'message': '긴급: 설비 이상 감지',
        'createdBy': userCtrl.text.isEmpty ? '00000000-0000-0000-0000-000000000000' : userCtrl.text,
      });
      if (!mounted) return; ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('보고 완료: ${res['id']}')));
    } catch (e) {
      if (!mounted) return; ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('실패: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: ListView(
        children: [
          const Text('FamilyOne', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          const Text('데모용 사용자 ID 입력(서버 seed 사용자 사용):'),
          TextField(controller: userCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'userId (UUID)')),
          const SizedBox(height: 12),
          ElevatedButton(onPressed: quickReport, child: const Text('원클릭 보고(설비 고장)')),
          const SizedBox(height: 12),
          const Text('하단 탭에서 기능을 탐색하세요.')
        ],
      ),
    );
  }
}