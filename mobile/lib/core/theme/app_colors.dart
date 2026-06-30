import 'package:flutter/material.dart';

/// Design tokens ported from the RN `mobile/src/constants/theme.ts`.
/// Owned by Apoorva (design). Keep in sync with the design spec.
class AppColors {
  AppColors._();

  static const Color primary = Color(0xFF1A6B4A); // Uniscope green
  static const Color primaryLight = Color(0xFFE8F5EE);
  static const Color primaryDark = Color(0xFF0F4A33);
  static const Color accent = Color(0xFFF4A261);

  static const Color background = Color(0xFFF8F9FA);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFE5E7EB);

  // Text
  static const Color textPrimary = Color(0xFF111827);
  static const Color textSecondary = Color(0xFF6B7280);
  static const Color textMuted = Color(0xFF9CA3AF);
  static const Color textInverse = Color(0xFFFFFFFF);

  // Status
  static const Color success = Color(0xFF10B981);
  static const Color error = Color(0xFFEF4444);
  static const Color warning = Color(0xFFF59E0B);
  static const Color info = Color(0xFF3B82F6);

  static const Color verified = Color(0xFF1A6B4A);
  static const Color unverified = Color(0xFF9CA3AF);
}
