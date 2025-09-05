import 'package:flutter/material.dart';
import '../api/client.dart';
import '../api/session.dart';
import '../api/auth_store.dart';
import 'org_admin.dart';
import 'auth.dart';
import 'package:flutter/material.dart';
import '../api/session.dart';

class HomeScreen extends StatefulWidget { const HomeScreen({super.key}); @override State<HomeScreen> createState()=>_HomeScreenState(); }
class _HomeScreenState extends State<HomeScreen> {
  final ApiClient api = ApiClient();

  Future<void> quickReport() async {
    try {
      if ((ApiSession.userId ?? '').isEmpty) throw Exception('로그인이 필요합니다');
      final res = await api.post('/api/reports', {
        'type': 'machine_fault',
        'message': '긴급: 설비 이상 감지',
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
          if ((ApiSession.userName ?? '').isNotEmpty) Text('${ApiSession.userName} (${ApiSession.role ?? '-'})'),
          const SizedBox(height: 12),
          // UUID 입력 제거: 로그인 사용자로 자동 처리
          const SizedBox(height: 12),
          ElevatedButton(onPressed: quickReport, child: const Text('원클릭 보고(설비 고장)')),
          const SizedBox(height: 8),
          if (ApiSession.role == 'admin') ElevatedButton(onPressed: (){ Navigator.of(context).push(MaterialPageRoute(builder: (_) => const OrgAdminScreen())); }, child: const Text('조직 관리')),
          const SizedBox(height: 8),
          ElevatedButton(onPressed: () async { await clearAuth(); ApiSession.token=null; ApiSession.userId=null; ApiSession.userName=null; ApiSession.role=null; if (!context.mounted) return; Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const AuthScreen()), (route)=>false); }, child: const Text('로그아웃')),
          const SizedBox(height: 12),
          const Text('하단 탭에서 기능을 탐색하세요.')
        ],
      ),
    );
  }
}
