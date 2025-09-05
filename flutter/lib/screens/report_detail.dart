import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../api/client.dart';
import '../api/session.dart';

class ReportDetailScreen extends StatefulWidget {
  final String id;
  const ReportDetailScreen({super.key, required this.id});
  @override
  State<ReportDetailScreen> createState() => _ReportDetailScreenState();
}

class _ReportDetailScreenState extends State<ReportDetailScreen> {
  final ApiClient api = ApiClient();
  Map<String, dynamic>? item;
  bool loading = true;
  bool editing = false;
  final msgCtrl = TextEditingController();

  bool get isOwner => (item?['createdBy'] ?? '') == (ApiSession.userId ?? '');
  bool get canReview => (ApiSession.role == 'manager' || ApiSession.role == 'admin');

  Future<void> load() async {
    setState(()=>loading=true);
    try {
      final list = await api.get('/api/reports');
      final found = (list as List).cast<Map>().firstWhere((e) => e['id'] == widget.id, orElse: () => {} as Map);
      item = Map<String, dynamic>.from(found);
      msgCtrl.text = (item?['message'] ?? '') as String;
    } finally { if (mounted) setState(()=>loading=false); }
  }

  @override void initState(){ super.initState(); load(); }

  Future<void> saveMessage() async {
    try {
      await api.post('/api/reports/${widget.id}/self', { 'message': msgCtrl.text });
      setState(()=>editing=false); await load();
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('메시지 저장 실패')));
    }
  }

  Future<void> setStatus(String status) async {
    try { await api.patch('/api/reports/${widget.id}', { 'status': status }); await load(); } catch (_) {}
  }

  Future<void> addImage() async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1600, imageQuality: 85);
      if (picked == null) return;
      final bytes = await picked.readAsBytes();
      final dataUrl = 'data:image/${picked.path.endsWith('.png') ? 'png' : 'jpeg'};base64,' + base64Encode(bytes);
      final up = await api.post('/api/uploads/base64', { 'data': dataUrl, 'filename': picked.name });
      final url = up['url'] as String;
      try { await api.post('/api/reports/${widget.id}/self', { 'addImages': [url] }); }
      catch (_) { await api.patch('/api/reports/${widget.id}', { 'addImages': [url] }); }
      await load();
    } catch (_) {
      if (!mounted) return; ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('업로드 실패')));
    }
  }

  Future<void> removeImage(String url) async {
    try {
      try { await api.post('/api/reports/${widget.id}/self', { 'removeImages': [url] }); }
      catch (_) { await api.patch('/api/reports/${widget.id}', { 'removeImages': [url] }); }
      await load();
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('삭제 실패')));
    }
  }

  Future<void> deleteReport() async {
    try {
      final res = await api.deleteRaw('/api/reports/${widget.id}');
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (!mounted) return; Navigator.of(context).pop(true);
      } else { throw HttpException(res.body); }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('삭제 실패')));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading || item == null || item!.isEmpty) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final images = (item!['images'] as List?)?.cast<String>() ?? [];
    return Scaffold(
      appBar: AppBar(title: const Text('보고 상세')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Text('종류: ${item!['type'] ?? ''}'),
        const SizedBox(height: 8),
        const Text('메시지', style: TextStyle(fontWeight: FontWeight.w600)),
        if (editing) ...[
          TextField(controller: msgCtrl, maxLines: null, decoration: const InputDecoration(border: OutlineInputBorder())),
          const SizedBox(height: 8),
          Row(children: [
            FilledButton(onPressed: saveMessage, child: const Text('저장')),
            const SizedBox(width: 8),
            TextButton(onPressed: ()=>setState(()=>editing=false), child: const Text('취소')),
          ])
        ] else ...[
          Text(item!['message'] ?? ''),
          if (isOwner) Align(alignment: Alignment.centerLeft, child: TextButton(onPressed: ()=>setState(()=>editing=true), child: const Text('수정'))),
        ],
        const SizedBox(height: 8),
        Text('상태: ${item!['status']}'),
        Text('${item!['createdAt']} / ${item!['createdBy']}'),
        const SizedBox(height: 12),
        const Text('사진', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final u in images)
            GestureDetector(
              onTap: () => showDialog(context: context, builder: (_) => AlertDialog(content: Image.network(ApiClient().base + u))),
              child: Stack(children: [
                Image.network(ApiClient().base + u, width: 120, height: 120, fit: BoxFit.cover),
                if (isOwner || canReview)
                  Positioned(right: 0, top: 0, child: IconButton(icon: const Icon(Icons.close, color: Colors.red), onPressed: ()=>removeImage(u)))
              ]),
            ),
          if (isOwner || canReview)
            OutlinedButton.icon(onPressed: addImage, icon: const Icon(Icons.add_a_photo), label: const Text('추가')),
        ]),
        const SizedBox(height: 12),
        if (canReview) Row(children: [
          ElevatedButton(onPressed: ()=>setStatus('ack'), child: const Text('접수')),
          const SizedBox(width: 8),
          ElevatedButton(onPressed: ()=>setStatus('resolved'), child: const Text('해결')),
        ]),
        if (isOwner || canReview) Padding(
          padding: const EdgeInsets.only(top: 8.0),
          child: TextButton(onPressed: deleteReport, style: TextButton.styleFrom(foregroundColor: Colors.red), child: const Text('보고 삭제')),
        ),
      ]),
    );
  }
}

