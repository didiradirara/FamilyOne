import 'package:flutter/material.dart';
import '../api/client.dart';
import 'report_detail.dart';
import '../api/session.dart';
import '../realtime/realtime.dart';

class ReportScreen extends StatefulWidget { const ReportScreen({super.key}); @override State<ReportScreen> createState()=>_ReportScreenState(); }
class _ReportScreenState extends State<ReportScreen> {
  final ApiClient api = ApiClient();
  final TextEditingController msgCtrl = TextEditingController();
  final TextEditingController userCtrl = TextEditingController();
  List<dynamic> items = [];
  final TextEditingController qCtrl = TextEditingController();
  String typeFilter = 'all';
  String statusFilter = 'all';

  Future<void> load() async { items = await api.get('/api/reports'); if (mounted) setState(() {}); }

  Future<void> submit() async {
    try {
      await api.post('/api/reports', {
        'type': 'machine_fault',
        'message': msgCtrl.text,
        'createdBy': userCtrl.text.isNotEmpty ? userCtrl.text : (ApiSession.userId ?? '00000000-0000-0000-0000-000000000000'),
      });
      if (!mounted) return; msgCtrl.clear();
      await load();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('보고 완료')));
    } catch (e) { if (!mounted) return; ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('실패: $e')));}    
  }

  Future<void> setStatus(String id, String status) async {
    try { await api.patch('/api/reports/'+id, { 'status': status }); await load(); } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('실패: $e'))); }
  }

  @override void initState(){ super.initState(); load(); try { RealtimeStore.I.clear('reports'); } catch (_) {} }

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
        const Divider(),
        const Text('보고 목록'),
        const SizedBox(height: 8),
        TextField(controller: qCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '검색(메시지/종류/상태)')),
        const SizedBox(height: 8),
        Row(children: [
          DropdownButton<String>(value: typeFilter, items: const [
            DropdownMenuItem(value: 'all', child: Text('전체 종류')),
            DropdownMenuItem(value: 'machine_fault', child: Text('설비고장')),
            DropdownMenuItem(value: 'material_shortage', child: Text('자재부족')),
            DropdownMenuItem(value: 'defect', child: Text('불량')),
            DropdownMenuItem(value: 'other', child: Text('기타')),
          ], onChanged: (v){ setState(()=> typeFilter = v ?? 'all'); }),
          const SizedBox(width: 8),
          DropdownButton<String>(value: statusFilter, items: const [
            DropdownMenuItem(value: 'all', child: Text('전체 상태')),
            DropdownMenuItem(value: 'new', child: Text('신규')),
            DropdownMenuItem(value: 'ack', child: Text('접수')),
            DropdownMenuItem(value: 'resolved', child: Text('해결')),
          ], onChanged: (v){ setState(()=> statusFilter = v ?? 'all'); }),
        ]),
        const SizedBox(height: 8),
        Expanded(child: ListView.builder(itemCount: items.where((it){
          final s = '${it['message']} ${it['type']} ${it['status']}'.toString().toLowerCase();
          final okQ = qCtrl.text.trim().isEmpty || s.contains(qCtrl.text.trim().toLowerCase());
          final okT = typeFilter=='all' || it['type']==typeFilter; final okS = statusFilter=='all' || it['status']==statusFilter; return okQ && okT && okS; }).length,
          itemBuilder: (c,i){ final filtered = items.where((it){
            final s = '${it['message']} ${it['type']} ${it['status']}'.toString().toLowerCase();
            final okQ = qCtrl.text.trim().isEmpty || s.contains(qCtrl.text.trim().toLowerCase());
            final okT = typeFilter=='all' || it['type']==typeFilter; final okS = statusFilter=='all' || it['status']==statusFilter; return okQ && okT && okS; }).toList();
            final it = filtered[i];
            return Card(child: ListTile(
              title: Text('[${it['status']}] ${it['type']}'),
              subtitle: Text(it['message'] ?? ''),
              onTap: () { Navigator.of(context).push(MaterialPageRoute(builder: (_) => ReportDetailScreen(id: it['id'] as String))).then((_) => load()); },
              trailing: Wrap(spacing: 8, children: [
                IconButton(icon: const Icon(Icons.how_to_vote), tooltip: '확인', onPressed: () => setStatus(it['id'], 'ack')),
                IconButton(icon: const Icon(Icons.done_all), tooltip: '해결', onPressed: () => setStatus(it['id'], 'resolved')),
              ]),
            ));
          }))
      ]),
    );
  }
}
