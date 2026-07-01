import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';

/// The RN primary CTA button: filled green, disabled → border colour,
/// loading → spinner. Reused across auth and onboarding screens.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.enabled = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final isDisabled = !enabled || loading;
    return SizedBox(
      width: double.infinity,
      child: Material(
        color: isDisabled ? AppColors.border : AppColors.primary,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: InkWell(
          onTap: isDisabled ? null : onPressed,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: Container(
            constraints: const BoxConstraints(minHeight: 50),
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
            child: loading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor:
                          AlwaysStoppedAnimation(AppColors.textInverse),
                    ),
                  )
                : Text(
                    label,
                    style: const TextStyle(
                      color: AppColors.textInverse,
                      fontSize: AppFont.md,
                      fontWeight: AppFont.semibold,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}
