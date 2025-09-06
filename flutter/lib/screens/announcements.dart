import 'dart:convert';
import 'package:flutter/material.dart';
import '../api/client.dart';
import '../api/session.dart';
import '../realtime/realtime.dart';
import 'package:image_picker/image_picker.dart';

class AnnouncementsScreen extends StatefulWidget { const AnnouncementsScreen({super.key}); @override State<AnnouncementsScreen> createState()=>_AnnouncementsScreenState(); }
class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  final ApiClient api = ApiClient();
  final TextEditingController titleCtrl = TextEditingController();
  final TextEditingController bodyCtrl = TextEditingController();
  final List<String> attachments = [];
  bool mandatory = false;
  String? site;
  String? team;
  String? teamDetail;
  List<Map<String, dynamic>> teams = [];
  List<dynamic> items = [];

  Future<void> load() async {
    final isAdmin = ApiSession.role == 'admin';
    final qs = (!isAdmin && (ApiSession.site ?? '').isNotEmpty)
        ? '?site=${ApiSession.site}&team=${Uri.encodeComponent(ApiSession.team ?? '')}&teamDetail=${Uri.encodeComponent(ApiSession.teamDetail ?? '')}'
        : '';
    items = await api.get('/api/announcements$qs');
    if (mounted) setState(() {});
  }
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
      if (site != null && site!.isNotEmpty) 'site': site,
      if (team != null && team!.isNotEmpty) 'team': team,
      if (teamDetail != null && teamDetail!.isNotEmpty) 'teamDetail': teamDetail,
      'mandatory': mandatory,
      'attachments': attachments,
    });
    titleCtrl.clear(); bodyCtrl.clear(); attachments.clear(); mandatory=false; teamDetail=null; await load();
  }

  Future<void> markRead(String id) async {
    final uid = ApiSession.userId;
    if (uid == null || uid.isEmpty) return;
    try { await api.post('/api/announcements/$id/read', { 'userId': uid }); await load(); } catch (_) {}
  }

  Future<void> loadTeams(String siteKey) async {
    try {
      final list = await api.get('/api/org/teams?site=$siteKey') as List<dynamic>;
      teams = list.map((e)=> Map<String,dynamic>.from(e as Map)).toList();
      setState(() {});
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = (ApiSession.role == 'admin');
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        const Text('공지', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        if (isAdmin) ...[
          Row(children:[
            const Text('대상:'), const SizedBox(width:8),
            DropdownButton<String>(
              hint: const Text('사이트'),
              value: site,
              items: const [
                DropdownMenuItem(value: 'hq', child: Text('본사')),
                DropdownMenuItem(value: 'jeonju', child: Text('전주')),
                DropdownMenuItem(value: 'busan', child: Text('부산')),
              ],
              onChanged: (v){ setState(()=>{ site = v, team=null, teamDetail=null }); if (v!=null) loadTeams(v); },
            ),
            const SizedBox(width: 8),
            DropdownButton<String>(
              hint: const Text('팀'), value: team,
              items: teams.map((t)=> DropdownMenuItem(value: t['team'] as String, child: Text(t['team'] as String))).toList(),
              onChanged: (v){ setState(()=>{ team = v; teamDetail=null; }); },
            ),
            const SizedBox(width: 8),
            DropdownButton<String>(
              hint: const Text('세부팀'), value: teamDetail,
              items: [for (final t in teams) if (t['team']==team) ...((t['details'] as List?)??[]).map((d)=>DropdownMenuItem(value: d as String, child: Text(d as String)))],
              onChanged: (v){ setState(()=> teamDetail = v); },
            ),
          ]),
          TextField(controller: titleCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '제목')),
          const SizedBox(height: 8),
          TextField(controller: bodyCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '내용')),
          const SizedBox(height: 8),
          Row(children:[
            Checkbox(value: mandatory, onChanged: (v)=> setState(()=> mandatory = v ?? false )), const Text('필수 확인'),
            const Spacer(),
            OutlinedButton.icon(onPressed: () async {
              try {
                final picker = ImagePicker();
                final picked = await picker.pickMultiImage(maxWidth: 1600, imageQuality: 85);
                if (picked.isEmpty) return;
                for (final x in picked) {
                  final bytes = await x.readAsBytes();
                  final isPng = x.path.toLowerCase().endsWith('.png');
                  final dataUrl = 'data:image/' + (isPng ? 'png' : 'jpeg') + ';base64,' + base64Encode(bytes);
                  try {
                    final up = await api.post('/api/uploads/base64', { 'data': dataUrl, 'filename': x.name });
                    final url = up['url'] as String?;
                    if (url != null && mounted) setState(()=> attachments.add(url));
                  } catch (_) {}
                }
              } catch (_) {}
            }, icon: const Icon(Icons.attach_file), label: const Text('이미지 첨부')),
          ]),
          if (attachments.isNotEmpty) Align(alignment: Alignment.centerLeft, child: Wrap(spacing: 8, runSpacing: 8, children: [ for (final u in attachments) Chip(label: Text(u.split('/').last), onDeleted: () => setState(()=> attachments.remove(u))) ])),
          const SizedBox(height: 8),
          ElevatedButton(onPressed: submit, child: const Text('공지 등록')),
          const Divider(),
        ],
        Expanded(child: ListView.builder(itemCount: items.length, itemBuilder: (c,i){
          final it = items[i] as Map<String, dynamic>;
          final readN = (it['readBy'] as List?)?.length ?? 0;
          return Card(child: ListTile(
            title: Row(children:[ Expanded(child: Text(it['title'] ?? '')), if ((it['mandatory'] ?? false) == true) const Padding(padding: EdgeInsets.only(left:8), child: Chip(label: Text('필수'))), ]),
            subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children:[
              Text(it['body'] ?? ''),
              if ((it['attachments'] as List?)?.isNotEmpty == true)
                Padding(padding: const EdgeInsets.only(top: 4), child: Wrap(spacing: 8, runSpacing: 4, children: [ for (final u in (it['attachments'] as List).cast<String>()) InkWell(
                  onTap: ()=> showDialog(context: context, builder: (_)=> AlertDialog(content: Image.network(ApiClient().base + (u.startsWith('/')?u:'/$u')))),
                  child: Text('첨부:' + u.split('/').last),
                ) ])),
            ]),
            trailing: Column(mainAxisAlignment: MainAxisAlignment.center, children:[
              Text('읽음 $readN'),
              if (isAdmin && (it['mandatory'] ?? false)==true) TextButton(onPressed: () async {
                try {
                  final list = await api.get('/api/announcements/${it['id']}/unread') as List<dynamic>;
                  if (!mounted) return;
                  showDialog(context: context, builder: (_)=> AlertDialog(title: const Text('미확인자'), content: SizedBox(width: 360, child: ListView(shrinkWrap: true, children:[ for (final u in list) ListTile(title: Text(u['name'] ?? ''), subtitle: Text('${u['team'] ?? ''}${(u['teamDetail']??'')!=''?' / '+(u['teamDetail']??''):''} (${u['role'] ?? ''})')) ]))));
                } catch (_) {}
              }, child: const Text('미확인자'))
            ]),
            onTap: () => markRead(it['id'] as String),
          ));
        }))
      ]),
    );
  }
}
