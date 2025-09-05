import 'package:flutter/material.dart';
import '../api/client.dart';
import '../api/session.dart';

class OrgAdminScreen extends StatefulWidget { const OrgAdminScreen({super.key}); @override State<OrgAdminScreen> createState()=>_OrgAdminScreenState(); }

class _OrgAdminScreenState extends State<OrgAdminScreen> {
  final ApiClient api = ApiClient();
  Map<String, dynamic>? data;
  bool loading = true;
  String site = 'hq';
  final newTeamCtrl = TextEditingController();
  final newDetailsCtrl = TextEditingController();
  String? editId;
  final editTeamCtrl = TextEditingController();
  final editDetailsCtrl = TextEditingController();

  Future<void> load() async { setState(()=>loading=true); try { data = await api.get('/api/org'); } finally { if (mounted) setState(()=>loading=false); } }
  @override void initState(){ super.initState(); load(); }

  List<dynamic> get teams => (data?['teams']?[site] as List? ?? []);

  Future<void> addTeam() async { try { final details = newDetailsCtrl.text.split(',').map((e)=>e.trim()).where((e)=>e.isNotEmpty).toList(); await api.post('/api/org/team', { 'site': site, 'team': newTeamCtrl.text.trim(), 'details': details }); newTeamCtrl.clear(); newDetailsCtrl.clear(); await load(); } catch (e) { _toast('추가 실패: $e'); } }
  Future<void> delTeam(String id) async { try { final res = await api.deleteRaw('/api/org/team/$id'); if (res.statusCode>=200&&res.statusCode<300) await load(); else throw Exception(res.body); } catch (e) { _toast('삭제 실패: $e'); } }
  void startEdit(Map it){ editId = it['id'] as String; editTeamCtrl.text = it['team'] ?? ''; editDetailsCtrl.text = (it['details'] as List?)?.join(', ') ?? ''; setState((){}); }
  Future<void> saveEdit() async { if (editId==null) return; try { final details = editDetailsCtrl.text.split(',').map((e)=>e.trim()).where((e)=>e.isNotEmpty).toList(); await api.patch('/api/org/team/$editId', { 'team': editTeamCtrl.text.trim(), 'details': details }); editId=null; editTeamCtrl.clear(); editDetailsCtrl.clear(); await load(); } catch (e) { _toast('수정 실패: $e'); } }

  void _toast(String msg){ if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg))); }

  @override
  Widget build(BuildContext context) {
    if (ApiSession.role != 'admin') return const Center(child: Text('권한이 없습니다.'));
    if (loading || data == null) return const Center(child: CircularProgressIndicator());
    return Padding(
      padding: const EdgeInsets.all(16),
      child: ListView(children: [
        const Text('조직 관리', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Wrap(spacing: 8, children: [
          for (final s in ['hq','jeonju','busan']) ChoiceChip(label: Text(s), selected: site==s, onSelected: (_){ setState(()=>site=s); }),
        ]),
        const SizedBox(height: 8),
        const Text('팀 목록', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        for (final it in teams.cast<Map>()) Card(child: ListTile(title: Text(it['team'] ?? ''), subtitle: Text('세부담당: ${((it['details'] as List?)?.join(', ') ?? '-') }'), trailing: Wrap(spacing: 8, children: [
          TextButton(onPressed: ()=>startEdit(it), child: const Text('수정')),
          TextButton(onPressed: ()=>delTeam(it['id'] as String), style: TextButton.styleFrom(foregroundColor: Colors.red), child: const Text('삭제')),
        ]))),
        const SizedBox(height: 12),
        const Text('팀 추가', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        TextField(controller: newTeamCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '팀 이름')), const SizedBox(height: 4),
        TextField(controller: newDetailsCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '세부담당(쉼표로 구분)')), const SizedBox(height: 4),
        FilledButton(onPressed: addTeam, child: const Text('추가')),
        if (editId != null) ...[
          const Divider(), const Text('팀 수정', style: TextStyle(fontWeight: FontWeight.w600)), const SizedBox(height: 4),
          TextField(controller: editTeamCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '팀 이름')),
          const SizedBox(height: 4),
          TextField(controller: editDetailsCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '세부담당(쉼표로 구분)')),
          const SizedBox(height: 4),
          Row(children: [
            FilledButton(onPressed: saveEdit, child: const Text('저장')),
            const SizedBox(width: 8),
            TextButton(onPressed: (){ editId=null; editTeamCtrl.clear(); editDetailsCtrl.clear(); setState((){}); }, child: const Text('취소')),
          ])
        ]
      ]),
    );
  }
}

