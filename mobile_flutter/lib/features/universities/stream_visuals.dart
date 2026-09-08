import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/theme/app_theme.dart';

/// A stream's icon + colour + light tint — the "duotone thumbnail" look on
/// a college card, and the tint a filter pill takes on once that stream is
/// picked. One hue per stream, tuned to sit together rather than clash.
///
/// Shared by the Discover/Colleges tab and the Home "Top colleges for you"
/// rail so the per-stream glyph (a stethoscope for Medical, a tooth for
/// Dental, …) is the same in both places.
class StreamVisual {
  const StreamVisual(this.icon, this.color, this.tint, {this.assetPath});

  /// Fallback glyph, used unless [assetPath] is set.
  final IconData icon;
  final Color color;
  final Color tint;

  /// An SVG in assets/icons/ for streams that have no fitting Material icon
  /// (e.g. a tooth for Dental, a stethoscope for Medical). Tinted to [color].
  final String? assetPath;
}

/// The stream glyph — an asset SVG when the stream has one, else the
/// Material [StreamVisual.icon] fallback. Tinted to [color] when given
/// (e.g. white on a coloured header), otherwise to [v.color].
Widget streamGlyph(StreamVisual v, {double size = 20, Color? color}) {
  final tint = color ?? v.color;
  return v.assetPath != null
      ? SvgPicture.asset(
          v.assetPath!,
          width: size,
          height: size,
          colorFilter: ColorFilter.mode(tint, BlendMode.srcIn),
        )
      : Icon(v.icon, size: size, color: tint);
}

const kDefaultStreamVisual = StreamVisual(
  Icons.account_balance_rounded,
  AppColors.primary,
  AppColors.primaryLight,
);

const kStreamVisuals = <String, StreamVisual>{
  'Medical': StreamVisual(
    Icons.medical_services_rounded,
    Color(0xFF0B8F6A),
    Color(0xFFE3F4EE),
    assetPath: 'assets/icons/stethoscope.svg',
  ),
  'Dental': StreamVisual(
    Icons.health_and_safety_rounded,
    Color(0xFF7A63D4),
    Color(0xFFECE8FA),
    assetPath: 'assets/icons/tooth.svg',
  ),
  'Engineering': StreamVisual(
    Icons.engineering_rounded,
    Color(0xFFE08A2B),
    Color(0xFFFBEEDB),
  ),
  'Commerce & Business': StreamVisual(
    Icons.business_center_rounded,
    Color(0xFF3C79D4),
    Color(0xFFE5EEFB),
  ),
  'Law': StreamVisual(
    Icons.gavel_rounded,
    Color(0xFFD8566F),
    Color(0xFFFBE6EB),
  ),
  'Arts & Humanities': StreamVisual(
    Icons.palette_rounded,
    Color(0xFF12A5A0),
    Color(0xFFDFF3F2),
  ),
  'Design': StreamVisual(
    Icons.brush_rounded,
    Color(0xFF5B5FC7),
    Color(0xFFE7E8FB),
  ),
  'Others': StreamVisual(
    Icons.account_balance_rounded,
    Color(0xFF59636E),
    Color(0xFFEEF1F0),
  ),
};

StreamVisual streamVisualFor(String? stream) =>
    kStreamVisuals[stream] ?? kDefaultStreamVisual;
