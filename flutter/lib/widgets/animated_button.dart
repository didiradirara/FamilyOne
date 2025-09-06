import 'package:flutter/material.dart';

enum ButtonVariant { primary, danger, outline, surface }

class AnimatedButton extends StatefulWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final ButtonVariant variant;
  final EdgeInsetsGeometry padding;
  final double borderRadius;
  final IconData? leadingIcon;

  const AnimatedButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.variant = ButtonVariant.primary,
    this.padding = const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
    this.borderRadius = 14,
    this.leadingIcon,
  });

  @override
  State<AnimatedButton> createState() => _AnimatedButtonState();
}

class _AnimatedButtonState extends State<AnimatedButton>
    with SingleTickerProviderStateMixin {
  bool _pressed = false;

  Color _bg(BuildContext context) {
    switch (widget.variant) {
      case ButtonVariant.primary:
        return const Color(0xFF2D6CDF);
      case ButtonVariant.danger:
        return const Color(0xFFDC2626);
      case ButtonVariant.surface:
        return Theme.of(context).colorScheme.surfaceVariant;
      case ButtonVariant.outline:
        return Colors.transparent;
    }
  }

  Color _fg(BuildContext context) {
    switch (widget.variant) {
      case ButtonVariant.primary:
      case ButtonVariant.danger:
        return Colors.white;
      case ButtonVariant.surface:
        return Theme.of(context).colorScheme.onSurfaceVariant;
      case ButtonVariant.outline:
        return Theme.of(context).colorScheme.onSurface;
    }
  }

  @override
  Widget build(BuildContext context) {
    final disabled = widget.onPressed == null || widget.loading;
    final bg = _bg(context);
    final fg = _fg(context);
    final shadow = disabled
        ? Colors.transparent
        : Colors.black.withOpacity(_pressed ? 0.1 : 0.18);

    return AnimatedScale(
      duration: const Duration(milliseconds: 90),
      scale: _pressed ? 0.98 : 1.0,
      curve: Curves.easeOut,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        decoration: BoxDecoration(
          color: widget.variant == ButtonVariant.outline ? null : bg,
          borderRadius: BorderRadius.circular(widget.borderRadius),
          border: widget.variant == ButtonVariant.outline
              ? Border.all(
                  color: Theme.of(context).colorScheme.outlineVariant,
                  width: 1,
                )
              : null,
          boxShadow: [
            BoxShadow(
              color: shadow,
              blurRadius: _pressed ? 4 : 10,
              spreadRadius: 0,
              offset: Offset(0, _pressed ? 2 : 6),
            )
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(widget.borderRadius),
            onTap: disabled ? null : widget.onPressed,
            onTapDown: (_) => setState(() => _pressed = true),
            onTapCancel: () => setState(() => _pressed = false),
            onTapUp: (_) => setState(() => _pressed = false),
            child: Padding(
              padding: widget.padding,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (widget.loading) ...[
                    SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(fg),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ] else if (widget.leadingIcon != null) ...[
                    Icon(widget.leadingIcon, size: 18, color: fg),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    widget.label,
                    style: TextStyle(
                      color: widget.variant == ButtonVariant.outline
                          ? Theme.of(context).colorScheme.onSurface
                          : fg,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.2,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

