import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/network/promotions_api.dart';
import '../../core/network/wallet_api.dart'
    show kMinorUnitsPerUniminute, uniminutesLabel;
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import '../calls/call_overlay.dart' show CallOverlayController;

/// Minor units in one rupee (paise) — the mentor wallet reads in rupees.
const int _kMinorUnitsPerRupee = 100;

/// What a promotion added to the user's wallet, as a short line for the
/// popup, or null when it added nothing. Students read Uniminutes, mentors
/// read rupees — the same units their own Wallet screen uses.
String? promotionCreditLine(int creditedMinor, {required bool isMentor}) {
  if (creditedMinor <= 0) return null;
  if (isMentor) {
    final rupees = creditedMinor / _kMinorUnitsPerRupee;
    final text = rupees == rupees.roundToDouble()
        ? rupees.toStringAsFixed(0)
        : rupees.toStringAsFixed(2);
    return '₹$text has been added to your wallet.';
  }
  final minutes = creditedMinor ~/ kMinorUnitsPerUniminute;
  if (minutes <= 0) return null;
  return '${uniminutesLabel(minutes)} added to your wallet.';
}

/// The popup itself: title, message, an optional credit line and an optional
/// link button. Pops with `true` when the link button is pressed.
class PromotionDialog extends StatelessWidget {
  const PromotionDialog({
    super.key,
    required this.promotion,
    required this.isMentor,
    this.onOpenLink,
  });

  final PendingPromotion promotion;
  final bool isMentor;

  /// Called with the link when the button is pressed. Overridable for tests.
  final void Function(Uri link)? onOpenLink;

  @override
  Widget build(BuildContext context) {
    final link = promotion.safeLink;
    final credit = promotionCreditLine(
      promotion.creditedMinor,
      isMentor: isMentor,
    );

    return AlertDialog(
      icon: Container(
        width: 52,
        height: 52,
        decoration: const BoxDecoration(
          color: AppColors.primaryLight,
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: const Icon(
          Icons.card_giftcard_rounded,
          color: AppColors.primary,
          size: 26,
        ),
      ),
      title: Text(promotion.title, textAlign: TextAlign.center),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (promotion.body != null)
              Text(promotion.body!, textAlign: TextAlign.center),
            if (credit != null) ...[
              if (promotion.body != null) const SizedBox(height: AppSpacing.md),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm,
                ),
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Text(
                  credit,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.primaryDark,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
      actionsAlignment: MainAxisAlignment.center,
      actionsOverflowAlignment: OverflowBarAlignment.center,
      actionsOverflowButtonSpacing: AppSpacing.xs,
      actions: [
        if (link != null)
          FilledButton(
            onPressed: () {
              onOpenLink?.call(link);
              Navigator.of(context).pop(true);
            },
            child: Text(promotion.linkLabel ?? 'Open'),
          ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(link != null ? 'Not now' : 'Got it'),
        ),
      ],
    );
  }
}

/// Invisible widget mounted in the shell. When the app opens (and each time it
/// comes back to the foreground) it asks the server for promotions this user
/// has not seen and shows them one after another as a popup. Each is marked
/// seen the moment it is shown, so it appears only once — even if the app is
/// closed while the popup is up. Everything here is best effort: a failure
/// just means the popup is tried again next time, and never gets in the way.
class PromotionPopupHost extends ConsumerStatefulWidget {
  const PromotionPopupHost({super.key});

  @override
  ConsumerState<PromotionPopupHost> createState() => _PromotionPopupHostState();
}

class _PromotionPopupHostState extends ConsumerState<PromotionPopupHost>
    with WidgetsBindingObserver {
  bool _checking = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _check());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _check();
  }

  Future<void> _openLink(Uri link) async {
    final ok = await launchUrl(link, mode: LaunchMode.externalApplication)
        .catchError((_) => false);
    if (!ok && mounted) {
      showAppSnackBar(context, "Couldn't open that link.");
    }
  }

  Future<void> _check() async {
    if (_checking || !mounted) return;
    _checking = true;
    try {
      final pending = await ref.read(promotionsApiProvider).pending();
      for (final promotion in pending) {
        if (!mounted) return;
        // Never cover a live call; the popup waits for the next open.
        if (CallOverlayController.instance.isActive) return;
        final isMentor =
            ref.read(authControllerProvider).user?.role == UserRole.mentor;

        // Mark it seen first: shown once, whatever happens next.
        await ref
            .read(promotionsApiProvider)
            .markSeen(promotion.id)
            .catchError((_) {});
        if (!mounted) return;
        await showDialog<bool>(
          context: context,
          useRootNavigator: true,
          builder: (_) => PromotionDialog(
            promotion: promotion,
            isMentor: isMentor,
            onOpenLink: _openLink,
          ),
        );
      }
    } catch (_) {
      // Best effort — tried again next time the app opens.
    } finally {
      _checking = false;
    }
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
