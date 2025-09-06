import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import '../api/client.dart';

class EducationDetailScreen extends StatefulWidget {
  final String id;
  const EducationDetailScreen({super.key, required this.id});
  @override
  State<EducationDetailScreen> createState() => _EducationDetailScreenState();
}

class _EducationDetailScreenState extends State<EducationDetailScreen> {
  final ApiClient api = ApiClient();
  Map<String, dynamic>? item;
  bool loading = true;

  Future<void> load() async {
    setState(()=> loading = true);
    try {
      final it = await api.get('/api/education/${widget.id}');
      item = Map<String, dynamic>.from(it as Map);
    } finally { if (mounted) setState(()=> loading = false); }
  }

  @override
  void initState() { super.initState(); load(); }

  Future<void> complete() async {
    final sig = await showDialog<String>(context: context, builder: (_)=> const _SignatureDialog());
    if (sig==null) return;
    try {
      await api.post('/api/education/${widget.id}/complete', { 'signature': sig });
      await load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('교육 완료')));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('처리 실패')));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading || item == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final attachments = (item!['attachments'] as List?)?.cast<String>() ?? [];
    final completed = (item!['completedByMe'] ?? false) as bool;
    return Scaffold(
      appBar: AppBar(title: Text(item!['title'] ?? '')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Text('연도: ${item!['year']}'),
        const SizedBox(height: 8),
        const Text('내용', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        Text(item!['content'] ?? ''),
        const SizedBox(height: 12),
        if (attachments.isNotEmpty) ...[
          const Text('첨부', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Wrap(spacing: 8, runSpacing: 4, children: [
            for (final u in attachments)
              TextButton.icon(onPressed: (){ showDialog(context: context, builder: (_)=> AlertDialog(content: Image.network(ApiClient().base + (u.startsWith('/')?u:'/$u')))); }, icon: const Icon(Icons.download), label: Text(u.split('/').last))
          ]),
        ],
        const SizedBox(height: 16),
        if (!completed) FilledButton(onPressed: complete, child: const Text('Complete (Sign)')) else const Text('Already completed')
      ]),
    );
  }
}

class _SignatureDialog extends StatefulWidget {
  const _SignatureDialog();
  @override
  State<_SignatureDialog> createState() => _SignatureDialogState();
}

class _SignatureDialogState extends State<_SignatureDialog> {
  final GlobalKey _repaintKey = GlobalKey();
  final List<List<ui.Offset>> _strokes = [];

  bool get _hasInk => _strokes.any((s) => s.length > 1);

  void _onPanStart(DragStartDetails d) { setState(() => _strokes.add([d.localPosition])); }
  void _onPanUpdate(DragUpdateDetails d) { setState(() => _strokes.last.add(d.localPosition)); }
  void _clear() => setState(() => _strokes.clear());

  Future<Uint8List?> _exportPng() async {
    try {
      final boundary = _repaintKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) return null;
      final ui.Image image = await boundary.toImage(pixelRatio: 3.0);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      return byteData?.buffer.asUint8List();
    } catch (_) { return null; }
  }

  Future<void> _onConfirm() async {
    if (!_hasInk) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('서명을 입력해 주세요'))); return; }
    final bytes = await _exportPng();
    if (bytes == null) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('이미지 생성 실패'))); return; }
    final b64 = base64Encode(bytes);
    final dataUrl = 'data:image/png;base64,' + b64;
    try {
      final api = ApiClient();
      final res = await api.post('/api/uploads/base64', { 'data': dataUrl });
      final url = res['url'] as String?;
      if (mounted) Navigator.of(context).pop(url);
    } catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('업로드 실패'))); }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('서명'),
      content: Column(mainAxisSize: MainAxisSize.min, children:[
        SizedBox(
          width: 360, height: 180,
          child: DecoratedBox(
            decoration: BoxDecoration(color: Colors.white, border: Border.all(color: Colors.grey.shade400)),
            child: RepaintBoundary(
              key: _repaintKey,
              child: GestureDetector(
                onPanStart: _onPanStart,
                onPanUpdate: _onPanUpdate,
                child: CustomPaint(painter: _SignaturePainter(_strokes), child: const SizedBox.expand()),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children:[
          TextButton.icon(onPressed: _clear, icon: const Icon(Icons.refresh), label: const Text('지우기')),
          const SizedBox.shrink(),
        ])
      ]),
      actions: [
        TextButton(onPressed: ()=>Navigator.pop(context), child: const Text('취소')),
        FilledButton(onPressed: _onConfirm, child: const Text('확인')),
      ],
    );
  }
}

class _SignaturePainter extends CustomPainter {
  final List<List<ui.Offset>> strokes;
  const _SignaturePainter(this.strokes);
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black
      ..strokeWidth = 3.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    for (final stroke in strokes) {
      if (stroke.length < 2) continue;
      final path = Path()..moveTo(stroke.first.dx, stroke.first.dy);
      for (int i=1;i<stroke.length;i++) { path.lineTo(stroke[i].dx, stroke[i].dy); }
      canvas.drawPath(path, paint);
    }
  }
  @override
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) => true;
}

