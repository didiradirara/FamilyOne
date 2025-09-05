import 'package:flutter/material.dart';
import '../api/client.dart';
import '../api/session.dart';
import '../realtime/realtime.dart';

class AnnouncementsScreen extends StatefulWidget { const AnnouncementsScreen({super.key}); @override State<AnnouncementsScreen> createState()=>_AnnouncementsScreenState(); }
class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  final ApiClient api = ApiClient();
  final TextEditingController titleCtrl = TextEditingController();
  final TextEditingController bodyCtrl = TextEditingController();
  List<dynamic> items = [];
  Future<void> load() async { items = await api.get('/api/announcements'); if (mounted) setState(() {}); }
  @override void initState(){ super.initState(); load(); try { RealtimeStore.I.clear('announcements'); } catch (_) {} }

  Future<void> submit() async {
    final uid = ApiSession.userId ?? '';
    if (uid.isEmpty) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('로그인이 필요합니다')));
      return;
    }
    await api.post('/api/announcements', {
      'title': titleCtrl.text,
      'body': bodyCtrl.text,
      'createdBy': uid,
    });
    titleCtrl.clear(); bodyCtrl.clear(); await load();
  }

  Future<void> markRead(String id) async {
    final uid = ApiSession.userId;
    if (uid == null || uid.isEmpty) return;
    try { await api.post('/api/announcements/$id/read', { 'userId': uid }); await load(); } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final canCreate = (ApiSession.role == 'manager' || ApiSession.role == 'admin');
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        const Text('공지', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        if (canCreate) ...[
          TextField(controller: titleCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '제목')),
          const SizedBox(height: 8),
          TextField(controller: bodyCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '내용')),
          const SizedBox(height: 8),
          ElevatedButton(onPressed: submit, child: const Text('공지 등록')),
          const Divider(),
        ],
        Expanded(child: ListView.builder(itemCount: items.length, itemBuilder: (c,i){
          final it = items[i];
          return ListTile(
            title: Text(it['title'] ?? ''),
            subtitle: Text(it['body'] ?? ''),
            trailing: Text('읽음 ${ (it['readBy'] as List?)?.length ?? 0 }'),
            onTap: () => markRead(it['id'] as String),
          );
        }))
      ]),
    );
  }
}
