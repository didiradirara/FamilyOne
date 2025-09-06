import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
import '../api/session.dart';
import '../api/client.dart';

class EducationAdminScreen extends StatefulWidget {
  const EducationAdminScreen({super.key});
  @override
  State<EducationAdminScreen> createState() => _EducationAdminScreenState();
}

class _EducationAdminScreenState extends State<EducationAdminScreen> {
  final ApiClient api = ApiClient();
  List<dynamic> items = [];
  bool loading = true;
  // Inline quick-create form state
  final TextEditingController titleCtrl = TextEditingController();
  final TextEditingController contentCtrl = TextEditingController();
  int year = DateTime.now().year;
  final List<String> attachments = [];
  bool saving = false;

  Future<void> load() async {
    setState(() => loading = true);
    try {
      items = await api.get('/api/education');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> pickAttachments() async {
    try {
      final result = await FilePicker.platform.pickFiles(allowMultiple: true, withData: true);
      if (result == null) return;
      for (final f in result.files) {
        if (f.bytes == null) continue;
        final uri = Uri.parse(ApiClient().base + '/api/uploads/stream?filename=${Uri.encodeComponent(f.name)}');
        final res = await http.post(
          uri,
          headers: {
            if ((ApiSession.token ?? '').isNotEmpty) 'Authorization': 'Bearer ${ApiSession.token}',
            'Content-Type': 'application/octet-stream',
          },
          body: f.bytes,
        );
        if (res.statusCode >= 200 && res.statusCode < 300) {
          final m = jsonDecode(res.body) as Map<String, dynamic>;
          final url = (m['url'] ?? '') as String;
          if (url.isNotEmpty && mounted) setState(()=> attachments.add(url));
        }
      }
    } catch (_) {}
  }

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> createOrEdit({Map<String, dynamic>? existing}) async {
    final res = await showDialog<bool>(
        context: context,
        builder: (_) => _CourseEditorDialog(api: api, existing: existing));
    if (res == true) await load();
  }

  Future<void> del(String id) async {
    final ok = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
                title: const Text('삭제 확인'),
                content: const Text('삭제하시겠습니까?'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('아니오')),
                  FilledButton(
                      onPressed: () => Navigator.pop(context, true),
                      child: const Text('예'))
                ]));
    if (ok != true) return;
    try {
      final r = await api.deleteRaw('/api/education/' + id);
      if (r.statusCode >= 200 && r.statusCode < 300)
        await load();
      else
        throw Exception(r.body);
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('삭제 실패: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('교육 등록/관리'), actions: [
        IconButton(onPressed: () => createOrEdit(), icon: const Icon(Icons.add))
      ]),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('새 교육 등록',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    Row(children: [
                      const Text('년도:'),
                      const SizedBox(width: 8),
                      DropdownButton<int>(
                        value: year,
                        items: [
                          for (int y = DateTime.now().year;
                              y >= DateTime.now().year - 5;
                              y--)
                            y
                        ]
                            .map((y) =>
                                DropdownMenuItem(value: y, child: Text('$y')))
                            .toList(),
                        onChanged: (v) {
                          if (v != null) setState(() => year = v);
                        },
                      )
                    ]),
                    const SizedBox(height: 8),
                    TextField(
                        controller: titleCtrl,
                        decoration: const InputDecoration(
                            border: OutlineInputBorder(), hintText: '제목')),
                    const SizedBox(height: 8),
                    TextField(
                        controller: contentCtrl,
                        minLines: 4,
                        maxLines: null,
                        decoration: const InputDecoration(
                            border: OutlineInputBorder(), hintText: '내용')),
                    const SizedBox(height: 8),
                    Row(children: [
                      OutlinedButton.icon(
                          onPressed: pickAttachments,
                          icon: const Icon(Icons.attach_file),
                          label: const Text('이미지 첨부')),
                      const SizedBox(width: 8),
                      FilledButton(
                          onPressed: saving
                              ? null
                              : () async {
                                  if (saving) return;
                                  setState(() => saving = true);
                                  try {
                                    await api.post('/api/education', {
                                      'year': year,
                                      'title': titleCtrl.text,
                                      'content': contentCtrl.text,
                                      'attachments': attachments
                                    });
                                    titleCtrl.clear();
                                    contentCtrl.clear();
                                    attachments.clear();
                                    await load();
                                    if (mounted)
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(const SnackBar(
                                              content: Text('등록 완료')));
                                  } catch (e) {
                                    if (mounted)
                                      ScaffoldMessenger.of(context)
                                          .showSnackBar(SnackBar(
                                              content: Text('등록 실패: $e')));
                                  } finally {
                                    if (mounted) setState(() => saving = false);
                                  }
                                },
                          child: Text(saving ? '저장 중…' : '등록')),
                    ]),
                    if (attachments.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8.0),
                        child: Wrap(spacing: 6, children: [
                          for (final u in attachments)
                            Chip(
                                label: Text(u.split('/').last),
                                onDeleted: () =>
                                    setState(() => attachments.remove(u)))
                        ]),
                      ),
                    const SizedBox(height: 16),
                    const Divider(),
                    const SizedBox(height: 8),
                    const Text('등록된 교육',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    if (items.isEmpty)
                      const Expanded(
                          child: Center(
                              child: Text('등록된 교육이 없습니다. 위에서 새 교육을 등록하세요.')))
                    else
                      Expanded(
                        child: ListView.builder(
                          itemCount: items.length,
                          itemBuilder: (c, i) {
                            final it = items[i] as Map<String, dynamic>;
                            return Card(
                                child: ListTile(
                              title: Text('${it['year']} - ${it['title']}'),
                              subtitle: Text(((it['attachments'] as List?)
                                              ?.length ??
                                          0) ==
                                      0
                                  ? '첨부 0'
                                  : '첨부 ${(it['attachments'] as List).length}'),
                              trailing: Wrap(spacing: 8, children: [
                                IconButton(
                                    icon: const Icon(Icons.edit),
                                    onPressed: () =>
                                        createOrEdit(existing: it)),
                                IconButton(
                                    icon: const Icon(Icons.delete,
                                        color: Colors.red),
                                    onPressed: () => del(it['id'] as String)),
                              ]),
                            ));
                          },
                        ),
                      ),
                  ]),
            ),
    );
  }
}

class _CourseEditorDialog extends StatefulWidget {
  final ApiClient api;
  final Map<String, dynamic>? existing;
  const _CourseEditorDialog({required this.api, this.existing});
  @override
  State<_CourseEditorDialog> createState() => _CourseEditorDialogState();
}

class _CourseEditorDialogState extends State<_CourseEditorDialog> {
  late TextEditingController titleCtrl;
  late TextEditingController contentCtrl;
  int year = DateTime.now().year;
  final List<String> attachments = [];
  bool busy = false;

  @override
  void initState() {
    super.initState();
    titleCtrl = TextEditingController(text: widget.existing?['title'] ?? '');
    contentCtrl =
        TextEditingController(text: widget.existing?['content'] ?? '');
    year = (widget.existing?['year'] as int?) ?? DateTime.now().year;
    final list =
        (widget.existing?['attachments'] as List?)?.cast<String>() ?? [];
    attachments.addAll(list);
  }

  Future<void> pickAttachments() async {
    try {
      final result = await FilePicker.platform.pickFiles(allowMultiple: true, withData: true);
      if (result == null) return;
      for (final f in result.files) {
        if (f.bytes == null) continue;
        final uri = Uri.parse(ApiClient().base + '/api/uploads/stream?filename=${Uri.encodeComponent(f.name)}');
        final res = await http.post(
          uri,
          headers: {
            if ((ApiSession.token ?? '').isNotEmpty) 'Authorization': 'Bearer ${ApiSession.token}',
            'Content-Type': 'application/octet-stream',
          },
          body: f.bytes,
        );
        if (res.statusCode >= 200 && res.statusCode < 300) {
          final m = jsonDecode(res.body) as Map<String, dynamic>;
          final url = (m['url'] ?? '') as String;
          if (url.isNotEmpty && mounted) setState(()=> attachments.add(url));
        }
      }
    } catch (_) {}
  }

  Future<void> submit() async {
    if (busy) return;
    setState(() => busy = true);
    try {
      if ((widget.existing?['id'] as String?) == null) {
        await widget.api.post('/api/education', {
          'year': year,
          'title': titleCtrl.text,
          'content': contentCtrl.text,
          'attachments': attachments
        });
      } else {
        await widget.api.patch('/api/education/${widget.existing!['id']}', {
          'year': year,
          'title': titleCtrl.text,
          'content': contentCtrl.text,
          'attachments': attachments
        });
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('저장 실패: $e')));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final years = [
      for (int y = DateTime.now().year; y >= DateTime.now().year - 5; y--) y
    ];
    return AlertDialog(
      title: Text(widget.existing == null ? '교육 등록' : '교육 수정'),
      content: SingleChildScrollView(
        child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                const Text('년도:'),
                const SizedBox(width: 8),
                DropdownButton<int>(
                    value: year,
                    items: years
                        .map((y) =>
                            DropdownMenuItem(value: y, child: Text('$y')))
                        .toList(),
                    onChanged: (v) {
                      if (v != null) setState(() => year = v);
                    })
              ]),
              const SizedBox(height: 8),
              TextField(
                  controller: titleCtrl,
                  decoration: const InputDecoration(
                      border: OutlineInputBorder(), hintText: '제목')),
              const SizedBox(height: 8),
              TextField(
                  controller: contentCtrl,
                  minLines: 4,
                  maxLines: null,
                  decoration: const InputDecoration(
                      border: OutlineInputBorder(), hintText: '내용')),
              const SizedBox(height: 8),
              Row(children: [
                OutlinedButton.icon(
                    onPressed: pickAttachments,
                    icon: const Icon(Icons.attach_file),
                    label: const Text('이미지 첨부')),
              ]),
              if (attachments.isNotEmpty)
                Wrap(spacing: 6, children: [
                  for (final u in attachments)
                    Chip(
                        label: Text(u.split('/').last),
                        onDeleted: () => setState(() => attachments.remove(u)))
                ]),
            ]),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소')),
        FilledButton(
            onPressed: busy ? null : submit, child: Text(busy ? '저장 중…' : '저장'))
      ],
    );
  }
}
