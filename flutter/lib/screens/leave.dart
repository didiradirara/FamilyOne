import 'package:flutter/material.dart';
import '../api/client.dart';
import '../api/session.dart';
import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/rendering.dart';

class LeaveScreen extends StatefulWidget { const LeaveScreen({super.key}); @override State<LeaveScreen> createState()=>_LeaveScreenState(); }
class _LeaveScreenState extends State<LeaveScreen> {
  final ApiClient api = ApiClient();
  final TextEditingController userCtrl = TextEditingController();
  final TextEditingController startCtrl = TextEditingController();
  final TextEditingController endCtrl = TextEditingController();
  final TextEditingController reasonCtrl = TextEditingController(text: '개인사유');
  List<dynamic> items = [];
  Future<void> load() async {
    final uid = userCtrl.text.isNotEmpty ? userCtrl.text : (ApiSession.userId ?? '');
    items = await api.get('/api/leave-requests${uid.isEmpty ? '' : '?userId=$uid'}');
    if (mounted) setState(() {});
  }
  @override void initState(){
    super.initState();
    final d1 = DateTime.now().add(const Duration(days: 1));
    startCtrl.text = d1.toIso8601String().substring(0,10);
    endCtrl.text = d1.toIso8601String().substring(0,10);
    load();
  }
  Future<void> submit(String signature) async {
    await api.post('/api/leave-requests', {
      'userId': userCtrl.text.isEmpty ? '00000000-0000-0000-0000-000000000000' : userCtrl.text,
      'startDate': startCtrl.text,
      'endDate': endCtrl.text,
      'reason': reasonCtrl.text,
      'signature': signature,
    });
    startCtrl.clear();
    endCtrl.clear();
    reasonCtrl.text = '개인사유';
    await load();
  }

  Future<void> promptSignature() async {
    final url = await showDialog<String>(
      context: context,
      builder: (ctx) => _SignatureDialog(api: api),
    );
    if (url != null && url.isNotEmpty) await submit(url);
  }
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        const Text('휴가 신청', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        TextField(controller: userCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'userId(UUID)')),
        const SizedBox(height: 8),
        Row(children: [
          ElevatedButton(onPressed: (){ final d=DateTime.now(); startCtrl.text=d.toIso8601String().substring(0,10); setState((){}); }, child: const Text('시작=오늘')),
          const SizedBox(width: 8),
          ElevatedButton(onPressed: (){ final d=DateTime.now().add(const Duration(days:1)); startCtrl.text=d.toIso8601String().substring(0,10); setState((){}); }, child: const Text('시작=내일')),
        ]),
        TextField(controller: startCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '시작일 YYYY-MM-DD')),
        const SizedBox(height: 8),
        Row(children: [
          ElevatedButton(onPressed: (){ final d=DateTime.now(); endCtrl.text=d.toIso8601String().substring(0,10); setState((){}); }, child: const Text('종료=오늘')),
          const SizedBox(width: 8),
          ElevatedButton(onPressed: (){ final d=DateTime.now().add(const Duration(days:1)); endCtrl.text=d.toIso8601String().substring(0,10); setState((){}); }, child: const Text('종료=내일')),
        ]),
        TextField(controller: endCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '종료일 YYYY-MM-DD')),
        const SizedBox(height: 8),
        TextField(controller: reasonCtrl, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '개인사유')),
        const SizedBox(height: 8),
        ElevatedButton(onPressed: promptSignature, child: const Text('신청')),
        const Divider(),
        Expanded(child: ListView.builder(itemCount: items.length, itemBuilder: (c,i){ final it = items[i]; return ListTile(
          title: Text('${it['userId']} / ${it['startDate']}~${it['endDate']} / ${it['state']}'),
          subtitle: Text(it['reason'] ?? ''),
          trailing: (it['signature']??'').toString().isNotEmpty ? const Icon(Icons.image, color: Colors.teal) : null,
          onTap: (){
            final sig = (it['signature']??'') as String; if (sig.isEmpty) return;
            showDialog(context: context, builder: (_) => AlertDialog(content: Image.network(ApiClient().base + sig)));
          },
        ); }))
      ]),
    );
  }
}

class _SignatureDialog extends StatefulWidget {
  final ApiClient api;
  const _SignatureDialog({required this.api});
  @override
  State<_SignatureDialog> createState() => _SignatureDialogState();
}

class _SignatureDialogState extends State<_SignatureDialog> {
  final GlobalKey _repaintKey = GlobalKey();
  final List<List<ui.Offset>> _strokes = [];

  bool get _hasInk => _strokes.any((s) => s.length > 1);

  void _onPanStart(DragStartDetails d) {
    final box = context.findRenderObject() as RenderBox?;
    final p = box?.globalToLocal(d.globalPosition) ?? d.localPosition;
    setState(() => _strokes.add([p]));
  }

  void _onPanUpdate(DragUpdateDetails d) {
    final box = context.findRenderObject() as RenderBox?;
    final p = box?.globalToLocal(d.globalPosition) ?? d.localPosition;
    setState(() => _strokes.last.add(p));
  }

  void _clear() => setState(() => _strokes.clear());

  Future<Uint8List?> _exportPng() async {
    try {
      final boundary = _repaintKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) return null;
      final ui.Image image = await boundary.toImage(pixelRatio: 3.0);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      return byteData?.buffer.asUint8List();
    } catch (_) {
      return null;
    }
  }

  Future<void> _onConfirm() async {
    if (!_hasInk) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('서명을 입력해 주세요')));
      return;
    }
    final bytes = await _exportPng();
    if (bytes == null) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('이미지 생성 실패')));
      return;
    }
    final b64 = base64Encode(bytes);
    final dataUrl = 'data:image/png;base64,' + b64;
    try {
      final res = await widget.api.post('/api/uploads/base64', { 'data': dataUrl, 'filename': 'signature.png' });
      final url = res['url'] as String?;
      if (mounted) Navigator.of(context).pop(url);
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('업로드 실패')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('서명'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 400,
            height: 200,
            child: DecoratedBox(
              decoration: BoxDecoration(color: Colors.white, border: Border.all(color: Colors.grey.shade400)),
              child: RepaintBoundary(
                key: _repaintKey,
                child: GestureDetector(
                  onPanStart: _onPanStart,
                  onPanUpdate: _onPanUpdate,
                  child: CustomPaint(
                    painter: _SignaturePainter(_strokes),
                    child: const SizedBox.expand(),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              TextButton.icon(onPressed: _clear, icon: const Icon(Icons.refresh), label: const Text('지우기')),
              const SizedBox.shrink(),
            ],
          )
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('취소')),
        FilledButton(onPressed: _onConfirm, child: const Text('확인')),
      ],
    );
  }
}

class _SignaturePainter extends CustomPainter {
  final List<List<ui.Offset>> strokes;
  _SignaturePainter(this.strokes);

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
      for (int i = 1; i < stroke.length; i++) {
        path.lineTo(stroke[i].dx, stroke[i].dy);
      }
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) => !identical(oldDelegate.strokes, strokes);
}
