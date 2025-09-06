import 'package:flutter/material.dart';
import '../api/client.dart';
import '../api/session.dart';
import 'education_admin.dart';
import './edu_detail.dart';

class EducationListScreen extends StatefulWidget {
  const EducationListScreen({super.key});
  @override
  State<EducationListScreen> createState() => _EducationListScreenState();
}

class _EducationListScreenState extends State<EducationListScreen> {
  final ApiClient api = ApiClient();
  int year = DateTime.now().year;
  List<dynamic> items = [];

  Future<void> load() async {
    items = await api.get('/api/education?year=$year');
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  Widget build(BuildContext context) {
    final years = [for (int y = DateTime.now().year; y >= DateTime.now().year - 5; y--) y];
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('법정교육', style: textTheme.titleMedium),
          const SizedBox(height: 8),
          Row(children:[
            const Text('년도:'), const SizedBox(width: 8),
            DropdownButton<int>(
              value: year,
              items: years.map((y)=> DropdownMenuItem(value: y, child: Text('$y'))).toList(),
              onChanged: (v){ if (v!=null) { setState(()=>year=v); load(); } },
            )
          ]),
          Row(children:[
            const Expanded(child: Divider()),
            if (ApiSession.role == 'admin')
              TextButton.icon(
                onPressed: (){
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_)=> const EducationAdminScreen()),
                  );
                },
                icon: const Icon(Icons.admin_panel_settings),
                label: const Text('교육 등록/관리'),
              )
          ]),
          Expanded(child: ListView.builder(
            itemCount: items.length,
            itemBuilder: (c,i){
              final it = items[i] as Map<String, dynamic>;
              return Card(child: ListTile(
                title: Text(it['title'] ?? ''),
                subtitle: Text('년도: ${it['year']}'),
                onTap: (){
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => EducationDetailScreen(id: it['id'] as String),
                    ),
                  );
                },
              ));
            }
          )),
        ],
      ),
    );
  }
}

