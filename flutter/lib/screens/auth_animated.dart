import 'package:flutter/material.dart';
import '../api/client.dart';
import '../api/session.dart';
import '../main.dart';
import '../api/auth_store.dart';
import 'register.dart';
import '../widgets/animated_text_field.dart';
import '../widgets/animated_button.dart';

class AnimatedAuthScreen extends StatefulWidget {
  const AnimatedAuthScreen({super.key});
  @override
  State<AnimatedAuthScreen> createState() => _AnimatedAuthScreenState();
}

class _AnimatedAuthScreenState extends State<AnimatedAuthScreen> {
  final ApiClient api = ApiClient();
  final TextEditingController nameCtrl = TextEditingController();
  bool busy = false;

  Future<void> login() async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final nm = nameCtrl.text.trim();
      if (nm.isEmpty) throw Exception('이름을 입력해 주세요');
      final res = await api.post('/api/auth/login', { 'name': nm });
      ApiSession.token = res['token'] as String?;
      ApiSession.userId = res['user']?['id'] as String?;
      ApiSession.userName = res['user']?['name'] as String?;
      ApiSession.role = res['user']?['role'] as String?;
      ApiSession.site = res['user']?['site'] as String?;
      ApiSession.team = res['user']?['team'] as String?;
      ApiSession.teamDetail = res['user']?['teamDetail'] as String?;
      await saveAuth(ApiSession.token ?? '', Map<String, dynamic>.from(res['user'] as Map));
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const FamilyOneApp()),
        (route) => false,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('로그인 실패: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('로그인')),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('사용자 로그인', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  AnimatedTextField(
                    controller: nameCtrl,
                    hintText: '이름',
                    textInputAction: TextInputAction.done,
                    onSubmitted: login,
                  ),
                  const SizedBox(height: 12),
                  AnimatedButton(
                    label: busy ? '로그인 중…' : '로그인',
                    onPressed: busy ? null : login,
                    loading: busy,
                    variant: ButtonVariant.primary,
                  ),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const RegisterScreen()),
                        );
                      },
                      child: const Text('회원가입'),
                    ),
                  )
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

