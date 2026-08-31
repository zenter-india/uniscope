import 'package:flutter/material.dart';

/// Uniscope design system.
///
/// The token names (AppColors / AppSpacing / AppRadius / AppFont) predate
/// this pass and are referenced everywhere, so the premium restyle upgrades
/// their VALUES in place — every screen inherits the new look without a
/// mass rename. New concepts (shadows, gradients, text styles) get their
/// own token classes below.
class AppColors {
  // Brand — the real logo duotone (pulled directly from the app icon's
  // pixels, not eyeballed: navy #001A46, emerald #008562). Supersedes the
  // earlier all-teal restyle, which the client flagged as reading "light
  // and dull" — that teal (#12A9A3) and the old near-black ink (#0F1D17)
  // were both more desaturated than the actual logo. `primary`/`primaryDark`
  // are now the emerald half of the duo; `textPrimary` is the navy half,
  // doing double duty as body-text ink AND as a real UI fill color (the
  // Home header block) — the logo's navy was never a "text only" color.
  static const Color primary = Color(0xFF008562);
  static const Color primaryLight = Color(0xFFE3F3EC);
  static const Color primaryDark = Color(0xFF005E44);

  static const Color accent = Color(0xFFF4A261);

  // Neutrals — slate scale (cooler and richer than plain grays).
  static const Color background = Color(0xFFF6F8F9);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFE8ECEF);

  static const Color textPrimary = Color(0xFF001A46);
  static const Color textSecondary = Color(0xFF5E6D66);
  static const Color textMuted = Color(0xFF97A59E);
  static const Color textInverse = Color(0xFFFFFFFF);

  /// Light minty-emerald — for text/accents that need to sit ON the navy
  /// header block (plain `primary` emerald only measures ~3:1 there, too
  /// low for body text); 9.56:1 on `textPrimary` navy, checked not guessed.
  static const Color mintAccent = Color(0xFF4FD8B4);

  /// Semantic status colours. `success` is the retired old brand teal
  /// (#12A9A3) — reused deliberately rather than inventing a new hue, and
  /// it now needs to read as distinct from `primary` on its own: `primary`
  /// is emerald-green now (not teal), so a wallet credit shown in `success`
  /// no longer reads as "the brand button color", which is exactly the
  /// separation this token was already meant to preserve.
  static const Color success = Color(0xFF12A9A3);
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
    BoxShadow(color: Color(0x0A001A46), blurRadius: 16, offset: Offset(0, 4)),
    BoxShadow(color: Color(0x05001A46), blurRadius: 4, offset: Offset(0, 1)),
  ];

  static const List<BoxShadow> raised = [
    BoxShadow(color: Color(0x14008562), blurRadius: 24, offset: Offset(0, 8)),
  ];
}

class AppGradients {
  /// Compact brand fill for buttons, FABs, and banner cards. Same two
  /// endpoints as [canopy] — both emerald, light to dark.
  static const LinearGradient brand = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF008562), Color(0xFF005E44)],
  );

  /// Barely-there emerald wash for full-screen backgrounds behind cards.
  static const LinearGradient hero = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFFE3F3EC), Color(0xFFF6F8F9)],
  );

  /// Near-solid navy header block — the logo's other half of the duo, and
  /// the actual "Option B" client-approved direction: a real navy color
  /// block up top rather than a light wash, which is what made the app
  /// read as "light and dull" in the first place. Kept as a two-stop
  /// gradient purely for a whisper of depth, not a visible color travel —
  /// both stops round-trip to the same navy on inspection.
  ///
  /// Apply this to the canopy container itself (Home screen header), never
  /// to a full-screen background — stretched over a whole screen a header-
  /// sized gradient either clips oddly or reads as a flat, undifferentiated
  /// wash.
  static const LinearGradient canopy = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFF001A46), Color(0xFF001433)],
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
