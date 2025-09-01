import 'package:flutter/material.dart';
import 'screens/home.dart';
import 'screens/report.dart';
import 'screens/requests.dart';
import 'screens/announcements.dart';
import 'screens/checklist.dart';
import 'screens/suggestions.dart';
import 'screens/leave.dart';
import 'screens/schedule.dart';

void main() {
  runApp(const FamilyOneApp());
}

class FamilyOneApp extends StatefulWidget {
  const FamilyOneApp({super.key});
  @override
  State<FamilyOneApp> createState() => _FamilyOneAppState();
}

class _FamilyOneAppState extends State<FamilyOneApp> {
  int _index = 0;
  final _pages = const [
    HomeScreen(), ReportScreen(), RequestsScreen(), AnnouncementsScreen(),
    ChecklistScreen(), SuggestionsScreen(), LeaveScreen(), ScheduleScreen()
  ];

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FamilyOne',
      theme: ThemeData(useMaterial3: true),
      home: Scaffold(
        appBar: AppBar(title: const Text('FamilyOne')),
        body: _pages[_index],
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          destinations: const [
            NavigationDestination(icon: Icon(Icons.home), label: 'Home'),
            NavigationDestination(icon: Icon(Icons.report), label: 'Report'),
            NavigationDestination(icon: Icon(Icons.assignment), label: 'Requests'),
            NavigationDestination(icon: Icon(Icons.campaign), label: 'Announce'),
            NavigationDestination(icon: Icon(Icons.checklist), label: 'Checklist'),
            NavigationDestination(icon: Icon(Icons.lightbulb), label: 'Suggest'),
            NavigationDestination(icon: Icon(Icons.beach_access), label: 'Leave'),
            NavigationDestination(icon: Icon(Icons.schedule), label: 'Schedule'),
          ],
          onDestinationSelected: (i) => setState(() => _index = i),
        ),
      ),
    );
  }
}