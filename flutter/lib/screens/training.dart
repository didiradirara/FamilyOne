import 'package:flutter/material.dart';
import 'package:signature/signature.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/client.dart';
import 'dart:async';
import 'dart:convert';
import 'package:familyone_flutter/api/session.dart';
import 'package:familyone_flutter/components/state.dart';

class TrainingListScreen extends StatefulWidget {
  const TrainingListScreen({Key? key}) : super(key: key);

  @override
  _TrainingListScreenState createState() => _TrainingListScreenState();
}

class _TrainingListScreenState extends State<TrainingListScreen> {
  final ApiClient api = ApiClient();
  List<dynamic> trainings = [];
  bool loading = true;
  int selectedYear = DateTime.now().year;

  @override
  void initState() {
    super.initState();
    loadTrainings();
  }

  Future<void> loadTrainings() async {
    setState(() => loading = true);
    try {
      final data = await api.get('/api/trainings', params: {'year': selectedYear});
      setState(() {
        trainings = data;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to load trainings: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('법정 교육 목록 ($selectedYear)'),
        actions: [
          DropdownButton<int>(
            value: selectedYear,
            items: List.generate(5, (index) => DateTime.now().year - index)
                .map((year) => DropdownMenuItem(value: year, child: Text(year.toString())))
                .toList(),
            onChanged: (value) {
              if (value != null) {
                setState(() => selectedYear = value);
                loadTrainings();
              }
            },
          ),
        ],
      ),
      body: loading
          ? const Loading()
          : trainings.isEmpty
              ? const Empty(label: '해당 연도의 교육이 없습니다.')
              : ListView.builder(
                  itemCount: trainings.length,
                  itemBuilder: (context, index) {
                    final training = trainings[index];
                    return ListTile(
                      title: Text(training['title']),
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => TrainingDetailScreen(training: training)),
                      ),
                    );
                  },
                ),
    );
  }
}

class TrainingDetailScreen extends StatefulWidget {
  final dynamic training;
  const TrainingDetailScreen({Key? key, required this.training}) : super(key: key);

  @override
  _TrainingDetailScreenState createState() => _TrainingDetailScreenState();
}

class _TrainingDetailScreenState extends State<TrainingDetailScreen> {
  final ApiClient api = ApiClient();
  bool _isCompleted = false;

  @override
  void initState() {
    super.initState();
    _checkCompletionStatus();
  }

  Future<void> _checkCompletionStatus() async {
    try {
      final completions = await api.get('/api/training-completions');
      final isCompleted = completions.any((c) => c['trainingId'] == widget.training['id']);
      if (mounted) {
        setState(() {
          _isCompleted = isCompleted;
        });
      }
    } catch (e) {
      // Handle error
    }
  }

  final SignatureController _controller = SignatureController(
    penStrokeWidth: 1,
    penColor: Colors.black,
    exportBackgroundColor: Colors.white,
  );

  void _showSignaturePad() {
    showModalBottomSheet(
      context: context,
      builder: (BuildContext context) {
        return Column(
          children: [
            Expanded(child: Signature(controller: _controller)),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                ElevatedButton(
                  child: const Text('취소'),
                  onPressed: () => Navigator.of(context).pop(),
                ),
                ElevatedButton(
                  child: const Text('완료'),
                  onPressed: () async {
                    if (_controller.isNotEmpty) {
                      final signatureBytes = await _controller.toPngBytes();
                      if (signatureBytes == null) return;

                      try {
                        final apiClient = ApiClient();
                        final signatureDataUrl = 'data:image/png;base64,${base64Encode(signatureBytes)}';
                        final uploadRes = await apiClient.post('/api/uploads/base64', {'data': signatureDataUrl});
                        final signatureUrl = uploadRes['url'];

                        await apiClient.post('/api/trainings/${widget.training['id']}/complete', {
                          'signature': signatureUrl,
                        });

                        Navigator.of(context).pop();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('교육 완료 처리되었습니다.')),
                        );
                      } catch (e) {
                        Navigator.of(context).pop();
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('오류: $e')),
                        );
                      }
                    }
                  },
                ),
              ],
            )
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.training['title'])),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.training['content'], style: const TextStyle(fontSize: 16)),
            const SizedBox(height: 20),
            if (widget.training['attachmentUrl'] != null)
              ElevatedButton(
                onPressed: () async {
                  final url = Uri.parse(widget.training['attachmentUrl']);
                  if (await canLaunchUrl(url)) {
                    await launchUrl(url);
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Could not launch URL')),
                    );
                  }
                },
                child: const Text('첨부파일 다운로드'),
              ),
            const SizedBox(height: 20),
            _isCompleted
                ? const Text('이미 완료된 교육입니다.', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold))
                : ElevatedButton(
                    onPressed: _showSignaturePad,
                    child: const Text('교육 완료'),
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                  ),
          ],
        ),
      ),
    );
  }
}
