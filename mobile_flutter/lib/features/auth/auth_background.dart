import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

// Named alias kept because the pre-auth screens read more clearly with it,
// but it resolves to the shared brand token — there is exactly one teal in
// the app, defined in AppColors.
const authBrandTeal = AppColors.primary;
const authBrandNavy = Color(0xFF0F2A3E);

/// Soft decorative backdrop shared by the pre-auth screens (Login, OTP) —
/// a few low-opacity blob shapes and a bottom wave, matching the reference
/// design without needing real illustration assets.
class AuthBackground extends StatelessWidget {
  const AuthBackground({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned.fill(
          child: ColoredBox(color: Colors.white),
        ),
        Positioned(
          top: -60,
          right: -60,
          child: Container(
            width: 200,
            height: 200,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: authBrandTeal.withValues(alpha: 0.06),
            ),
          ),
        ),
        Positioned(
          top: 40,
          right: 24,
          child: Icon(Icons.add_rounded,
              size: 28, color: authBrandTeal.withValues(alpha: 0.18)),
        ),
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          child: IgnorePointer(
            child: SizedBox(
              height: 90,
              width: double.infinity,
              child: CustomPaint(
                painter: _WavePainter(color: authBrandTeal.withValues(alpha: 0.08)),
              ),
            ),
          ),
        ),
        child,
      ],
    );
  }
}

class _WavePainter extends CustomPainter {
  _WavePainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    final path = Path()
      ..moveTo(0, size.height * 0.5)
      ..quadraticBezierTo(
          size.width * 0.25, size.height * 0.2, size.width * 0.5, size.height * 0.45)
      ..quadraticBezierTo(
          size.width * 0.75, size.height * 0.7, size.width, size.height * 0.35)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _WavePainter oldDelegate) => oldDelegate.color != color;
}

/// The real Uniscope icon mark (graduation cap + magnifying glass) used on
/// Splash/Welcome/Login/OTP, cropped from the full logo so it reads clearly
/// at small sizes next to the "Uniscope" wordmark text.
class AuthLogoMark extends StatelessWidget {
  const AuthLogoMark({super.key, this.size = 40, this.outlined = false});
  final double size;
  final bool outlined;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/logo/uniscope_icon.png',
      width: size,
      height: size,
      fit: BoxFit.contain,
    );
  }
}
