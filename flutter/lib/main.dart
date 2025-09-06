import 'package:flutter/material.dart';
import 'screens/home.dart';
import 'screens/report.dart';
import 'screens/announcements.dart';
import 'screens/leave.dart';
import 'screens/schedule.dart';
import 'screens/auth_animated.dart';
import 'screens/approvals.dart';
import 'package:familyone_flutter/screens/education_list.dart';
import 'api/session.dart';
import 'api/auth_store.dart';
import 'realtime/realtime.dart';
import 'theme/theme.dart';

// Global key to allow auth screen to trigger a top-level rebuild
final GlobalKey<_FamilyOneAppState> familyOneAppKey = GlobalKey<_FamilyOneAppState>();

void main() {
  runApp(FamilyOneApp(key: familyOneAppKey));
}

class FamilyOneApp extends StatefulWidget {
  const FamilyOneApp({super.key});
  @override
  State<FamilyOneApp> createState() => _FamilyOneAppState();
}

class _FamilyOneAppState extends State<FamilyOneApp> {
  int _index = 0;
  int _lastIndex = 0;
  late List<Widget> _pages;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    ApiSession.onUnauthorized = () {
      ApiSession.token = null; ApiSession.userId = null; ApiSession.userName = null; ApiSession.role = null; ApiSession.site = null;
      Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const AnimatedAuthScreen()), (route) => false);
      if (mounted) setState(() {});
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

  // Called by auth screen on successful login to refresh UI (avoid nesting MaterialApp)
  void onLoggedIn() {
    try { if ((ApiSession.token ?? '').isNotEmpty) { RealtimeStore.I.connect(); } } catch (_) {}
    if (mounted) setState(() {});
  }

  void _rebuildTabs() {
    final isMgr = (ApiSession.role == 'manager' || ApiSession.role == 'admin');
    _pages = [
      const HomeScreen(), const ReportScreen(), const AnnouncementsScreen(),
      if (isMgr) const ApprovalsScreen(),
      const EducationListScreen(), const LeaveScreen(), const ScheduleScreen(),
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
    final light = buildAppTheme(Brightness.light);
    final dark = buildAppTheme(Brightness.dark);
    return MaterialApp(
      title: 'FamilyOne',
      theme: light,
      darkTheme: dark,
      themeMode: ThemeMode.system,
      home: authed ? Scaffold(
        appBar: AppBar(title: const Text('FamilyOne'), actions: [
          if (_index == 0) IconButton(
            tooltip: '로그아웃',
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await clearAuth();
              ApiSession.token=null; ApiSession.userId=null; ApiSession.userName=null; ApiSession.role=null; ApiSession.site=null;
              if (!context.mounted) return;
              Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const AnimatedAuthScreen()), (route)=>false);
            },
          )
        ]),
        body: AnimatedSwitcher(
          duration: const Duration(milliseconds: 280),
          switchInCurve: Curves.easeOutCubic,
          switchOutCurve: Curves.easeOutCubic,
          layoutBuilder: (currentChild, previousChildren) {
            // Avoid keeping previous child in the tree to prevent GlobalKey collisions
            return currentChild ?? const SizedBox.shrink();
          },
          transitionBuilder: (child, anim) {
            final fromRight = _index >= _lastIndex;
            final offsetTween = Tween<Offset>(
              begin: fromRight ? const Offset(0.08, 0) : const Offset(-0.08, 0),
              end: Offset.zero,
            ).chain(CurveTween(curve: Curves.easeOutCubic));
            return FadeTransition(
              opacity: anim,
              child: SlideTransition(position: anim.drive(offsetTween), child: child),
            );
          },
          child: KeyedSubtree(key: ValueKey(_index), child: _pages[_index]),
        ),
        bottomNavigationBar: AnimatedBuilder(
          animation: RealtimeStore.I,
          builder: (context, _) {
            final isMgr = (ApiSession.role == 'manager' || ApiSession.role == 'admin');
            final dests = <NavigationDestination>[
              const NavigationDestination(icon: Icon(Icons.home), label: 'Home'),
              const NavigationDestination(icon: Icon(Icons.report), label: 'Report'),
              NavigationDestination(
                icon: Stack(children:[const Icon(Icons.campaign), if (RealtimeStore.I.announcements>0) Positioned(right:0,top:0, child: _Dot(RealtimeStore.I.announcements))]),
                label: 'Announce',
              ),
              if (isMgr) const NavigationDestination(icon: Icon(Icons.verified), label: 'Approvals'),
              const NavigationDestination(icon: Icon(Icons.school), label: 'Education'),
              const NavigationDestination(icon: Icon(Icons.beach_access), label: 'Leave'),
              const NavigationDestination(icon: Icon(Icons.schedule), label: 'Schedule'),
            ];
            return NavigationBar(
              selectedIndex: _index,
              destinations: dests,
              onDestinationSelected: (i) => setState(() { _lastIndex = _index; _index = i; }),
            );
          }
        ),
      ) : const AnimatedAuthScreen(),
    );
  }
}

class _Dot extends StatelessWidget {
  final int n;
  const _Dot(this.n);
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: scheme.error,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        n > 99 ? '99+' : '$n',
        style: TextStyle(color: scheme.onError, fontSize: 10, fontWeight: FontWeight.w700),
      ),
    );
  }
}
