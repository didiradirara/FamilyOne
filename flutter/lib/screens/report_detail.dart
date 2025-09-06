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
  final replyCtrl = TextEditingController();
  List<Map<String, dynamic>> replies = [];

  bool get isOwner => (item?['createdBy'] ?? '') == (ApiSession.userId ?? '');
  bool get canReview =>
      (ApiSession.role == 'manager' || ApiSession.role == 'admin');

  Future<void> load() async {
    setState(() => loading = true);
    try {
      final list = await api.get('/api/reports');
      final found = (list as List)
          .cast<Map>()
          .firstWhere((e) => e['id'] == widget.id, orElse: () => {} as Map);
      item = Map<String, dynamic>.from(found);
      msgCtrl.text = (item?['message'] ?? '') as String;
      await loadReplies();
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> saveMessage() async {
    try {
      await api
          .patch('/api/reports/${widget.id}/self', {'message': msgCtrl.text});
      setState(() => editing = false);
      await load();
    } catch (_) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('메시지 저장 실패')));
    }
  }

  Future<void> loadReplies() async {
    try {
      final list =
          await api.get('/api/reports/${widget.id}/replies') as List<dynamic>;
      replies = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) {
      replies = [];
    }
  }

  Future<void> addReply() async {
    final txt = replyCtrl.text.trim();
    if (txt.isEmpty) return;
    try {
      await api.post('/api/reports/${widget.id}/replies', {'content': txt});
      replyCtrl.clear();
      await loadReplies();
      if (mounted) setState(() {});
    } catch (_) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('답변 등록 실패')));
    }
  }

  Future<void> setStatus(String status) async {
    try {
      await api.patch('/api/reports/${widget.id}', {'status': status});
      await load();
    } catch (_) {}
  }

  Future<void> addImage() async {
    try {
      final src = await showModalBottomSheet<ImageSource>(
        context: context,
        builder: (_) => SafeArea(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('앨범에서 선택'),
              onTap: () => Navigator.pop(context, ImageSource.gallery)),
          ListTile(
              leading: const Icon(Icons.photo_camera),
              title: const Text('카메라로 촬영'),
              onTap: () => Navigator.pop(context, ImageSource.camera)),
        ])),
      );
      if (src == null) return;
      final picker = ImagePicker();
      final picked =
          await picker.pickImage(source: src, maxWidth: 1600, imageQuality: 85);
      if (picked == null) return;
      final bytes = await picked.readAsBytes();
      final dataUrl =
          'data:image/${picked.path.endsWith('.png') ? 'png' : 'jpeg'};base64,' +
              base64Encode(bytes);
      final up = await api.post(
          '/api/uploads/base64', {'data': dataUrl, 'filename': picked.name});
      final url = up['url'] as String;
      try {
        await api.patch('/api/reports/${widget.id}/self', {
          'addImages': [url]
        });
      } catch (_) {
        await api.patch('/api/reports/${widget.id}', {
          'addImages': [url]
        });
      }
      await load();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('업로드 실패')));
    }
  }

  Future<void> removeImage(String url) async {
    try {
      try {
        await api.patch('/api/reports/${widget.id}/self', {
          'removeImages': [url]
        });
      } catch (_) {
        await api.patch('/api/reports/${widget.id}', {
          'removeImages': [url]
        });
      }
      await load();
    } catch (_) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('삭제 실패')));
    }
  }

  Future<void> deleteReport() async {
    try {
      final res = await api.deleteRaw('/api/reports/${widget.id}');
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (!mounted) return;
        Navigator.of(context).pop(true);
      } else {
        throw HttpException(res.body);
      }
    } catch (_) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('삭제 실패')));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading || item == null || item!.isEmpty)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final images = (item!['images'] as List?)?.cast<String>() ?? [];
    String _statusKo(String s) {
      if (s == 'new') return '신규';
      if (s == 'ack') return '접수';
      if (s == 'resolved') return '해결';
      return s;
    }

    String _weekdayKo(int w) =>
        const ['', '월', '화', '수', '목', '금', '토', '일'][w > 0 && w < 8 ? w : 1];
    String _fmtKo(String iso) {
      try {
        final d = DateTime.parse(iso).toLocal();
        final ap = d.hour < 12 ? '오전' : '오후';
        final hh = d.hour % 12 == 0 ? 12 : d.hour % 12;
        final mm = d.minute.toString().padLeft(2, '0');
        return '${d.year}년${d.month}월${d.day}일(${_weekdayKo(d.weekday)}) $ap ${hh}시${mm}분';
      } catch (_) {
        return iso;
      }
    }

    final createdAt = (item!['createdAt'] ?? '') as String;
    final createdByName =
        (item!['userName'] ?? item!['createdBy'] ?? '') as String? ?? '';
    final createdByRole = (item!['userRole'] ?? '') as String? ?? '';
    final teamName = (item!['team'] ?? '') as String? ?? '';
    return Scaffold(
      appBar: AppBar(title: const Text('보고 상세')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Text('종류: ${item!['type'] ?? ''}'),
        const SizedBox(height: 8),
        const Text('메시지', style: TextStyle(fontWeight: FontWeight.w600)),
        if (editing) ...[
          TextField(
              controller: msgCtrl,
              maxLines: null,
              decoration: const InputDecoration(border: OutlineInputBorder())),
          const SizedBox(height: 8),
          Row(children: [
            FilledButton.icon(
                onPressed: saveMessage,
                icon: const Icon(Icons.save),
                label: const Text('저장')),
            const SizedBox(width: 8),
            TextButton(
                onPressed: () => setState(() => editing = false),
                child: const Text('취소')),
          ])
        ] else ...[
          Text(item!['message'] ?? '', style: const TextStyle(fontSize: 18)),
          if (isOwner)
            Align(
                alignment: Alignment.centerLeft,
                child: FilledButton.icon(
                    onPressed: () => setState(() => editing = true),
                    icon: const Icon(Icons.edit),
                    label: const Text('수정'))),
        ],
        const SizedBox(height: 8),
        Text('상태: ${_statusKo(item!['status'] as String? ?? '')}'),
        Text(
            '${_fmtKo(createdAt)} / $teamName $createdByName(${createdByRole})'),
        const SizedBox(height: 12),
        const Text('사진', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final u in images)
            GestureDetector(
              onTap: () => showDialog(
                  context: context,
                  builder: (_) => AlertDialog(
                      content: Image.network(ApiClient().base + u))),
              child: Stack(children: [
                Image.network(ApiClient().base + u,
                    width: 120, height: 120, fit: BoxFit.cover),
                if (isOwner || canReview)
                  Positioned(
                      right: 0,
                      top: 0,
                      child: IconButton(
                          icon: const Icon(Icons.close, color: Colors.red),
                          onPressed: () => removeImage(u)))
              ]),
            ),
          if (isOwner || canReview)
            OutlinedButton.icon(
                onPressed: addImage,
                icon: const Icon(Icons.add_a_photo),
                label: const Text('추가')),
        ]),
        const SizedBox(height: 12),
        if (canReview)
          Row(children: [
            ElevatedButton(
                onPressed: () => setStatus('ack'), child: const Text('접수')),
            const SizedBox(width: 8),
            ElevatedButton(
                onPressed: () => setStatus('resolved'),
                child: const Text('해결')),
          ]),
        if (isOwner || canReview)
          Padding(
            padding: const EdgeInsets.only(top: 8.0),
            child: TextButton(
                onPressed: deleteReport,
                style: TextButton.styleFrom(foregroundColor: Colors.red),
                child: const Text('보고 삭제')),
          ),
        const SizedBox(height: 16),
        const Text('답변', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        if (replies.isNotEmpty) ...[
          for (final r in replies)
            ListTile(
              title: Text(r['content'] ?? ''),
              subtitle: Text(
                  '${(r['user']?['name'] ?? '')} / ${(r['user']?['role'] ?? '')} / ${(r['user']?['team'] ?? '')}${(r['user']?['teamDetail'] ?? '') != '' ? ' / ' + (r['user']?['teamDetail'] ?? '') : ''}'),
              trailing: Text((r['createdAt'] ?? '') as String),
            ),
        ],
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
              child: TextField(
                  controller: replyCtrl,
                  maxLines: null,
                  decoration: const InputDecoration(
                      border: OutlineInputBorder(), hintText: '답변 입력'))),
          const SizedBox(width: 8),
          FilledButton(onPressed: addReply, child: const Text('등록')),
        ]),
      ]),
    );
  }
}
