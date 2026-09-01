import 'package:flutter/material.dart';

/// Uniscope design system.
///
/// The token names (AppColors / AppSpacing / AppRadius / AppFont) predate
/// this pass and are referenced everywhere, so the premium restyle upgrades
/// their VALUES in place — every screen inherits the new look without a
/// mass rename. New concepts (shadows, gradients, text styles) get their
/// own token classes below.
class AppColors {
  // Brand — the real logo green, picked from the app icon's own pixels
  // (#008562), replacing the earlier teal (#12A9A3). Client's choice from
  // a contrast-checked shortlist. Scoped to just this hue swap — no navy,
  // no structural changes to the canopy/header (that exploration was
  // reverted separately).
  static const Color primary = Color(0xFF008562);
  static const Color primaryLight = Color(0xFFE3F3EC);
  static const Color primaryDark = Color(0xFF005E44);

  static const Color accent = Color(0xFFF4A261);

  // Neutrals — slate scale (cooler and richer than plain grays).
  static const Color background = Color(0xFFF6F8F9);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFE8ECEF);

  static const Color textPrimary = Color(0xFF0F1D17);
  static const Color textSecondary = Color(0xFF5E6D66);
  static const Color textMuted = Color(0xFF97A59E);
  static const Color textInverse = Color(0xFFFFFFFF);

  /// Semantic status colours. `success` marks wallet credits, completed
  /// sessions, and confirmation ticks. Now that `primary` is itself green
  /// (#008562, not the old teal), these two are closer in hue than before
  /// — still distinguishable (brighter/yellower vs. the brand's deeper,
  /// teal-leaning green), but worth revisiting if a credit ever reads as
  /// "just another button" in practice.
  static const Color success = Color(0xFF12A150);
  static const Color error = Color(0xFFE5484D);
  static const Color warning = Color(0xFFF5A524);
  static const Color info = Color(0xFF2A72DC);

  static const Color verified = primary;
  static const Color unverified = Color(0xFF97A59E);
}

class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
  static const double xxl = 48;
}

class AppRadius {
  static const double sm = 10;
  static const double md = 14;
  static const double lg = 20;
  static const double xl = 28;
  static const double full = 9999;
}

class AppFont {
  static const double xs = 12;
  static const double sm = 14;
  static const double md = 16;
  static const double lg = 18;
  static const double xl = 22;
  static const double xxl = 28;
  static const double display = 34;

  static const FontWeight regular = FontWeight.w400;
  static const FontWeight medium = FontWeight.w500;
  static const FontWeight semibold = FontWeight.w600;
  static const FontWeight bold = FontWeight.w700;
  static const FontWeight extraBold = FontWeight.w800;
}

/// Soft layered shadows — replaces hard 1px borders as the primary
/// elevation cue. Cards float; they don't outline.
class AppShadows {
  static const List<BoxShadow> card = [
    BoxShadow(color: Color(0x0A0F1D17), blurRadius: 16, offset: Offset(0, 4)),
    BoxShadow(color: Color(0x050F1D17), blurRadius: 4, offset: Offset(0, 1)),
  ];

  static const List<BoxShadow> raised = [
    BoxShadow(color: Color(0x14008562), blurRadius: 24, offset: Offset(0, 8)),
  ];
}

class AppGradients {
  /// Compact brand fill for buttons, FABs, and banner cards. Same two
  /// endpoints as [canopy] — both the new brand green, light to dark.
  static const LinearGradient brand = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF008562), Color(0xFF005E44)],
  );

  /// Barely-there green wash for full-screen backgrounds behind cards.
  static const LinearGradient hero = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFFE3F3EC), Color(0xFFF6F8F9)],
  );

  /// Same light-to-dark travel as before, just in the new brand green
  /// instead of the old teal — interpolated between primary/primaryDark at
  /// the same stop positions, not a fresh guess.
  ///
  /// Apply this to the canopy container itself, never to a full-screen
  /// background: stretched over a whole screen the dark stop falls below
  /// the fold and only flat green is visible.
  static const LinearGradient canopy = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Color(0xFF008562),
      Color(0xFF007354),
      Color(0xFF00664A),
      Color(0xFF005E44),
    ],
    stops: [0.0, 0.46, 0.80, 1.0],
  );
}

ThemeData buildAppTheme() {
  return ThemeData(
    fontFamily: 'Manrope',
    useMaterial3: true,
    scaffoldBackgroundColor: AppColors.background,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      primary: AppColors.primary,
      surface: AppColors.surface,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.background,
      foregroundColor: AppColors.textPrimary,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: const TextStyle(
        fontFamily: 'Manrope',
        color: AppColors.textPrimary,
        fontSize: AppFont.xl,
        fontWeight: AppFont.extraBold,
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.textInverse,
        minimumSize: const Size(0, 50),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        textStyle: const TextStyle(
          fontFamily: 'Manrope',
          fontSize: AppFont.md,
          fontWeight: AppFont.bold,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.textPrimary,
        minimumSize: const Size(0, 50),
        side: const BorderSide(color: AppColors.border, width: 1.5),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        textStyle: const TextStyle(
          fontFamily: 'Manrope',
          fontSize: AppFont.md,
          fontWeight: AppFont.bold,
        ),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.textPrimary,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      contentTextStyle: const TextStyle(
        fontFamily: 'Manrope',
        color: AppColors.textInverse,
        fontSize: AppFont.sm,
        fontWeight: AppFont.medium,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.md,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: const BorderSide(color: AppColors.border, width: 1.5),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: const BorderSide(color: AppColors.border, width: 1.5),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
    ),
  );
}
