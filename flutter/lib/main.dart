import 'package:flutter/material.dart';
import 'screens/home.dart';
import 'screens/report.dart';
import 'screens/requests.dart';
import 'screens/announcements.dart';
import 'screens/checklist.dart';
import 'screens/suggestions.dart';
import 'screens/leave.dart';
import 'screens/schedule.dart';
import 'screens/auth.dart';
import 'screens/approvals.dart';
import 'api/session.dart';
import 'api/auth_store.dart';
import 'realtime/realtime.dart';

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
  late List<Widget> _pages;
  late List<NavigationDestination> _dests;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    ApiSession.onUnauthorized = () {
      ApiSession.token = null; ApiSession.userId = null; ApiSession.userName = null; ApiSession.role = null; ApiSession.site = null;
      Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const AuthScreen()), (route) => false);
    };
    () async {
      await loadAuth();
      if ((ApiSession.token ?? '').isNotEmpty) {
        RealtimeStore.I.connect();
      }
      if (mounted) setState(() { _loaded = true; });
    }();
    _rebuildTabs();
  }

  void _rebuildTabs() {
    final isMgr = (ApiSession.role == 'manager' || ApiSession.role == 'admin');
    _pages = [
      const HomeScreen(), const ReportScreen(), const RequestsScreen(), const AnnouncementsScreen(),
      if (isMgr) const ApprovalsScreen(),
      const ChecklistScreen(), const SuggestionsScreen(), const LeaveScreen(), const ScheduleScreen(),
    ];
    _dests = [
      const NavigationDestination(icon: Icon(Icons.home), label: 'Home'),
      const NavigationDestination(icon: Icon(Icons.report), label: 'Report'),
      const NavigationDestination(icon: Icon(Icons.assignment), label: 'Requests'),
      const NavigationDestination(icon: Icon(Icons.campaign), label: 'Announce'),
      if (isMgr) const NavigationDestination(icon: Icon(Icons.verified), label: 'Approvals'),
      const NavigationDestination(icon: Icon(Icons.checklist), label: 'Checklist'),
      const NavigationDestination(icon: Icon(Icons.lightbulb), label: 'Suggest'),
      const NavigationDestination(icon: Icon(Icons.beach_access), label: 'Leave'),
      const NavigationDestination(icon: Icon(Icons.schedule), label: 'Schedule'),
    ];
    if (_index >= _pages.length) _index = 0;
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded) {
      return const MaterialApp(home: Scaffold(body: Center(child: CircularProgressIndicator())));
    }
    final authed = (ApiSession.token ?? '').isNotEmpty;
    if (authed) _rebuildTabs();
    return MaterialApp(
      title: 'FamilyOne',
      theme: ThemeData(useMaterial3: true),
      home: authed ? Scaffold(
        appBar: AppBar(title: const Text('FamilyOne')),
        body: _pages[_index],
        bottomNavigationBar: AnimatedBuilder(
          animation: RealtimeStore.I,
          builder: (context, _) {
            final isMgr = (ApiSession.role == 'manager' || ApiSession.role == 'admin');
            final dests = <NavigationDestination>[
              const NavigationDestination(icon: Icon(Icons.home), label: 'Home'),
              const NavigationDestination(icon: Icon(Icons.report), label: 'Report'),
              NavigationDestination(
                icon: Stack(children:[const Icon(Icons.assignment), if (RealtimeStore.I.requests>0) Positioned(right:0,top:0, child: _Dot(RealtimeStore.I.requests))]),
                label: 'Requests',
              ),
              NavigationDestination(
                icon: Stack(children:[const Icon(Icons.campaign), if (RealtimeStore.I.announcements>0) Positioned(right:0,top:0, child: _Dot(RealtimeStore.I.announcements))]),
                label: 'Announce',
              ),
              if (isMgr) const NavigationDestination(icon: Icon(Icons.verified), label: 'Approvals'),
              const NavigationDestination(icon: Icon(Icons.checklist), label: 'Checklist'),
              const NavigationDestination(icon: Icon(Icons.lightbulb), label: 'Suggest'),
              const NavigationDestination(icon: Icon(Icons.beach_access), label: 'Leave'),
              const NavigationDestination(icon: Icon(Icons.schedule), label: 'Schedule'),
            ];
            return NavigationBar(
              selectedIndex: _index,
              destinations: dests,
              onDestinationSelected: (i) => setState(() => _index = i),
            );
          }
        ),
      ) : const AuthScreen(),
    );
  }
}

class _Dot extends StatelessWidget {
  final int n;
  const _Dot(this.n);
  @override
  Widget build(BuildContext context) {
    return Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(12)), child: Text(n>99?'99+':'$n', style: const TextStyle(color: Colors.white, fontSize: 10)));
  }
}
