import 'package:flutter/material.dart';
import '../api/client.dart';

class AnnouncementDetailScreen extends StatefulWidget {
  final String id;
  const AnnouncementDetailScreen({super.key, required this.id});
  @override
  State<AnnouncementDetailScreen> createState() =>
      _AnnouncementDetailScreenState();
}

class _AnnouncementDetailScreenState extends State<AnnouncementDetailScreen> {
  final ApiClient api = ApiClient();
  Map<String, dynamic>? item;
  bool loading = true;

  Future<void> load() async {
    setState(() => loading = true);
    try {
      final it = await api.get('/api/announcements/${widget.id}');
      item = Map<String, dynamic>.from(it as Map);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    load();
  }

  String _weekdayKo(int w) =>
      const ['', '월', '화', '수', '목', '금', '토', '일'][w > 0 && w < 8 ? w : 1];
  String _fmtKo(String iso) {
    try {
      final d = DateTime.parse(iso).toLocal();
      return '${d.year}년${d.month}월${d.day}일(${_weekdayKo(d.weekday)})';
    } catch (_) {
      return iso;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading || item == null)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final mandatory = (item!['mandatory'] ?? false) == true;
    final atts = (item!['attachments'] as List?)?.cast<String>() ?? [];
    final createdAt = (item!['createdAt'] ?? '') as String;
    final author =
        '${item!['createdByName'] ?? item!['createdBy']}${(item!['createdByRole'] ?? '') != '' ? ' (${item!['createdByRole']})' : ''}';
    final color = mandatory ? Colors.red : null;
    return Scaffold(
      appBar: AppBar(title: const Text('공지 상세')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Text(item!['title'] ?? '',
            style: TextStyle(
                fontSize: 20, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 8),
        Text(item!['body'] ?? '', style: TextStyle(fontSize: 16, color: color)),
        const SizedBox(height: 12),
        if (atts.isNotEmpty) ...[
          Text('첨부파일',
              style: TextStyle(fontWeight: FontWeight.w600, color: color)),
          const SizedBox(height: 4),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              for (final u in atts)
                TextButton.icon(
                  onPressed: () => showDialog(
                    context: context,
                    builder: (_) => AlertDialog(
                      content: Image.network(
                          ApiClient().base + (u.startsWith('/') ? u : '/$u')),
                    ),
                  ),
                  icon: const Icon(Icons.download),
                  label:
                      Text(u.split('/').last, style: TextStyle(color: color)),
                ),
            ],
          ),
          const SizedBox(height: 12),
        ],
        Text('${_fmtKo(createdAt)} / ${author}')
      ]),
    );
  }
}
