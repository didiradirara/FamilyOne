import 'package:flutter/material.dart';

class ZoomFadePageTransitionsBuilder extends PageTransitionsBuilder {
  const ZoomFadePageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final curve = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
    return FadeTransition(
      opacity: Tween<double>(begin: 0.85, end: 1).animate(curve),
      child: ScaleTransition(
        scale: Tween<double>(begin: 0.98, end: 1).animate(curve),
        child: SlideTransition(
          position: Tween<Offset>(begin: const Offset(0.05, 0), end: Offset.zero)
              .animate(curve),
          child: child,
        ),
      ),
    );
  }
}

