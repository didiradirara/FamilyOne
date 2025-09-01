import 'package:flutter/material.dart';
import '../api/client.dart';

class AnnouncementsScreen extends StatefulWidget { const AnnouncementsScreen({super.key}); @override State<AnnouncementsScreen> createState()=>_AnnouncementsScreenState(); }
class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  final ApiClient api = ApiClient();
  final TextEditingController titleCtrl = TextEditingController();
  final TextEditingController bodyCtrl = TextEditingController();
  final TextEditingController userCtrl = TextEditingController();
  List<dynamic> items = [];
  Future<void> load() async { items = await api.get('/api/announcements'); if (mounted) setState(() {}); }
  @override void initState(){ super.initState(); load(); }

  Future<void> submit() async {
    await api.post('/api/announcements', {
      'title': titleCtrl.text,
      'body': bodyCtrl.text,
      'createdBy': userCtrl.text.isEmpty ? '00000000-0000-0000-0000-000000000000' : userCtrl.text,
    });
    titleCtrl.clear(); bodyCtrl.clear(); await load();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        const Text('공지 등록/목록', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        TextField(controller: userCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '작성자 userId(UUID)')),
        const SizedBox(height: 8),
        TextField(controller: titleCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '제목')),
        const SizedBox(height: 8),
        TextField(controller: bodyCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '내용')),
        const SizedBox(height: 8),
        ElevatedButton(onPressed: submit, child: const Text('공지 등록')),
        const Divider(),
        Expanded(child: ListView.builder(itemCount: items.length, itemBuilder: (c,i){
          final it = items[i];
          return ListTile(title: Text(it['title'] ?? ''), subtitle: Text(it['body'] ?? ''), trailing: Text('읽음 ${ (it['readBy'] as List?)?.length ?? 0 }'));
        }))
      ]),
    );
  }
}