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
  final TextEditingController startCtrl = TextEditingController();
  final TextEditingController endCtrl = TextEditingController();
  final TextEditingController reasonCtrl = TextEditingController(text: '개인사유');
  List<dynamic> items = [];
  int totalDays = 0;
  int usedDays = 0;
  int remainingDays = 0;

  String _fmtKDate(DateTime d) {
    final yy = d.year % 100;
    return '${yy}년${d.month}월${d.day}일';
  }
  int _inclusiveDays(DateTime s, DateTime e) {
    final sd = DateTime(s.year, s.month, s.day);
    final ed = DateTime(e.year, e.month, e.day);
    return ed.difference(sd).inDays.abs() + 1;
  }
  String _rangeWithDays(String s, String e) {
    try {
      final sd = DateTime.parse(s);
      final ed = DateTime.parse(e);
      final k = '${_fmtKDate(sd)}~${_fmtKDate(ed)}';
      final days = _inclusiveDays(sd, ed);
      return '$k (${days}일간)';
    } catch (_) {
      return '$s~$e';
    }
  }
  Future<void> load() async {
    final uid = ApiSession.userId ?? '';
    final year = DateTime.now().year;
    final summary = await api.get('/api/leave/summary?year=$year');
    items = await api.get('/api/leave-requests${uid.isEmpty ? '' : '?userId=$uid'}');
    totalDays = (summary['totalDays'] ?? 0) as int;
    usedDays = (summary['usedDays'] ?? 0) as int;
    remainingDays = (summary['remainingDays'] ?? 0) as int;
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
    final uid = ApiSession.userId ?? '';
    if (uid.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('로그인이 필요합니다')));
      }
      return;
    }
    await api.post('/api/leave-requests', {
      'userId': uid,
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

  Future<void> _cancelLeaveDirect(String id) async {
    try {
      final res = await api.deleteRaw('/api/leave-requests/' + id);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await load();
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('취소되었습니다')));
      } else {
        throw Exception(res.body);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('취소 실패: $e')));
    }
  }

  Future<void> _requestCancelApproved(String id) async {
    try {
      await api.post('/api/leave-requests/' + id + '/cancel-request', {});
      await load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('취소신청 되었습니다')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('취소신청 실패: $e')));
    }
  }

  String _stateKo(String? s) {
    switch (s) {
      case 'pending': return '대기';
      case 'approved': return '승인';
      case 'rejected': return '거절';
      default: return s ?? '-';
    }
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
        // 사용자 ID 입력 제거: 로그인 사용자로 자동 처리
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
        // Summary: 총 연차, 사용연차, 남은연차
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Wrap(spacing: 12, runSpacing: 8, children: [
            Chip(label: Text('총 연차: ${totalDays}일')),
            Chip(label: Text('사용 연차: ${usedDays}일')),
            Chip(label: Text('남은 연차: ${remainingDays}일')),
          ]),
        ),
        Expanded(child: ListView.builder(itemCount: items.length, itemBuilder: (c,i){
          final it = items[i] as Map<String, dynamic>;
          final isMine = (ApiSession.userId ?? '') == (it['userId'] ?? '');
          final state = (it['state'] ?? '') as String?;
          final cancelState = (it['cancelState'] ?? 'none') as String;
          final statusText = _stateKo(state) + (cancelState == 'requested' ? ' (취소요청)' : '');
          final sigUrl = (it['signature'] ?? '') as String;
          return ListTile(
            title: Text("${(it['userName']??it['userId'])} / ${_rangeWithDays((it['startDate']??'') as String, (it['endDate']??'') as String)} / $statusText"),
            subtitle: Text((it['reason'] ?? '') as String),
            trailing: Row(mainAxisSize: MainAxisSize.min, children: [
              if (sigUrl.isNotEmpty) Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Image.network(ApiClient().base + sigUrl, width: 56, height: 40, fit: BoxFit.contain),
              ),
              if (isMine && cancelState != 'requested')
                if (state == 'approved')
                  IconButton(
                    tooltip: '취소신청',
                    icon: const Icon(Icons.undo, color: Colors.orange),
                    onPressed: () => _requestCancelApproved((it['id'] ?? '') as String),
                  )
                else
                  IconButton(
                    tooltip: '취소',
                    icon: const Icon(Icons.delete, color: Colors.red),
                    onPressed: () => _cancelLeaveDirect((it['id'] ?? '') as String),
                  ),
            ]),
            onTap: (){
              if (sigUrl.isEmpty) return;
              showDialog(context: context, builder: (_) => AlertDialog(content: Image.network(ApiClient().base + sigUrl)));
            },
          );
        }))
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
    final p = d.localPosition;
    setState(() => _strokes.add([p]));
  }

  void _onPanUpdate(DragUpdateDetails d) {
    final p = d.localPosition;
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
      // Omit filename to avoid overwriting and ensure unique storage name
      final res = await widget.api.post('/api/uploads/base64', { 'data': dataUrl });
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
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) => true;
}
