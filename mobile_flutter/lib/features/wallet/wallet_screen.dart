import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../core/network/payouts_api.dart';
import '../../core/network/sessions_api.dart' show kCallSlotMinutes;
import '../../core/network/users_api.dart';
import '../../core/network/wallet_api.dart';
import '../../core/theme/app_theme.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_widgets.dart';
import '../common/legal_links.dart';
import '../sessions/call_time_windows.dart' show clockLabel;

const _kGroupMonths = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/// "Today" / "Yesterday" / "12 Sep" — groups the activity list by day. Past-
/// oriented, so it's its own small helper rather than reusing
/// call_time_windows.dart's dayTabLabel/friendlyCallTime (those are built
/// for picking a future slot, not labelling history).
String _dayGroupLabel(DateTime dt) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final that = DateTime(dt.year, dt.month, dt.day);
  final delta = today.difference(that).inDays;
  if (delta == 0) return 'Today';
  if (delta == 1) return 'Yesterday';
  return '${dt.day} ${_kGroupMonths[dt.month - 1]}';
}

/// The four fixed recharge packages. `rupees`/`uniminutes` must match the
/// backend's `RECHARGE_PACKAGES` exactly (`create-topup.dto.ts`): the server
/// rejects any amount that isn't one of these. Non-linear: bigger packs give
/// more Uniminutes per rupee. `name`/`tagline` are display-only.
typedef RechargePackage =
    ({int rupees, int uniminutes, String name, String tagline});

/// Android/default prices.
const _kRechargePackagesAndroid = <RechargePackage>[
  (
    rupees: 250,
    uniminutes: 10,
    name: 'Sneak Peek',
    tagline: 'A focused conversation with a mentor who has lived on campus.',
  ),
  (
    rupees: 400,
    uniminutes: 20,
    name: 'Campus Tour',
    tagline:
        'Curated time to weigh your shortlist with informed, firsthand '
        'insight.',
  ),
  (
    rupees: 750,
    uniminutes: 40,
    name: 'Deep Dive',
    tagline: 'In-depth guidance on placements, academics, and campus culture.',
  ),
  (
    rupees: 1000,
    uniminutes: 60,
    name: 'Insider Pass',
    tagline:
        'Our most considered pack, for the decision that shapes your '
        'future.',
  ),
];

/// iOS prices — the same four packages at a flat 30% markup (2026-09-24,
/// per client decision to absorb Apple's App Store commission by charging
/// iOS users more up front, since checkout still goes through Razorpay on
/// both platforms, not Apple IAP). Every amount here must also exist in the
/// backend's RECHARGE_PACKAGES, mapped to the same Uniminute credit as its
/// Android counterpart above — see create-topup.dto.ts.
const _kRechargePackagesIOS = <RechargePackage>[
  (
    rupees: 325,
    uniminutes: 10,
    name: 'Sneak Peek',
    tagline: 'A focused conversation with a mentor who has lived on campus.',
  ),
  (
    rupees: 520,
    uniminutes: 20,
    name: 'Campus Tour',
    tagline:
        'Curated time to weigh your shortlist with informed, firsthand '
        'insight.',
  ),
  (
    rupees: 975,
    uniminutes: 40,
    name: 'Deep Dive',
    tagline: 'In-depth guidance on placements, academics, and campus culture.',
  ),
  (
    rupees: 1300,
    uniminutes: 60,
    name: 'Insider Pass',
    tagline:
        'Our most considered pack, for the decision that shapes your '
        'future.',
  ),
];

/// The list to actually offer in the top-up sheet, for the platform this
/// build is running on.
List<RechargePackage> get _rechargePackagesForPlatform =>
    Platform.isIOS ? _kRechargePackagesIOS : _kRechargePackagesAndroid;

final walletBalanceProvider = FutureProvider.autoDispose<Wallet>(
  (ref) => ref.watch(walletApiProvider).getBalance(),
);

final walletLedgerProvider = FutureProvider.autoDispose<List<LedgerEntry>>(
  (ref) => ref.watch(walletApiProvider).getLedger(),
);

final mentorPayoutsProvider = FutureProvider.autoDispose<List<PayoutRequest>>(
  (ref) => ref.watch(payoutsApiProvider).listMine(),
);

/// Real wallet screen: balance + ledger from the backend. Aspirants get a
/// Top Up flow (Razorpay Checkout, test mode) — on success we verify the
/// returned signature server-side and credit the wallet, see
/// WalletService.verifyAndCreditTopup for why (webhook URL isn't publicly
/// reachable from local dev). Mentors never top up their own wallet — they
/// only ever earn into it — so they get a Withdraw flow instead, requesting
/// a payout of their unpaid session earnings (amount is always
/// server-derived, never mentor-chosen — see PayoutsService).
class WalletScreen extends ConsumerStatefulWidget {
  const WalletScreen({super.key});

  @override
  ConsumerState<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends ConsumerState<WalletScreen> {
  late final Razorpay _razorpay;
  String? _pendingOrderId;
  bool _toppingUp = false;
  bool _withdrawing = false;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  Future<void> _startTopup(int amountMinor) async {
    setState(() => _toppingUp = true);
    try {
      final order = await ref
          .read(walletApiProvider)
          .createTopupOrder(amountMinor);
      _pendingOrderId = order.orderId;

      _razorpay.open({
        'key': order.keyId,
        'order_id': order.orderId,
        'amount': order.amountMinor,
        'currency': order.currency,
        'name': 'Uniscope',
        'description': 'Wallet top-up',
        'prefill': {'contact': '', 'email': ''},
        'theme': {'color': '#1A6B4A'},
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _toppingUp = false);
      showAppSnackBar(context, 'Could not start top-up: $e');
    }
  }

  Future<void> _onPaymentSuccess(PaymentSuccessResponse response) async {
    try {
      await ref
          .read(walletApiProvider)
          .verifyTopup(
            razorpayOrderId: response.orderId ?? _pendingOrderId ?? '',
            razorpayPaymentId: response.paymentId!,
            razorpaySignature: response.signature!,
          );
      ref.invalidate(walletBalanceProvider);
      ref.invalidate(walletLedgerProvider);
      if (!mounted) return;
      showAppSnackBar(context, 'Wallet topped up successfully');
    } catch (e) {
      if (!mounted) return;
      showAppSnackBar(context, 'Payment succeeded but crediting failed: $e');
    } finally {
      if (mounted) setState(() => _toppingUp = false);
    }
  }

  void _onPaymentError(PaymentFailureResponse response) {
    setState(() => _toppingUp = false);
    showAppSnackBar(context, 'Payment failed: ${response.message}');
  }

  void _onExternalWallet(ExternalWalletResponse response) {
    setState(() => _toppingUp = false);
  }

  Future<void> _requestWithdrawal() async {
    // Payouts are transferred to the mentor's UPI ID by hand — without one
    // on file the request can't be fulfilled (the backend rejects it too).
    String? upiId;
    try {
      upiId = (await ref.read(myProfileProvider.future)).upiId;
    } catch (_) {
      // fall through — the backend stays the backstop
    }
    if (upiId == null || upiId.trim().isEmpty) {
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Add a UPI ID first'),
          content: const Text(
            'Weekly payouts are sent to your UPI ID. Add one in '
            'Profile → Profile Details, then come back to request a payout.',
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Got it'),
            ),
          ],
        ),
      );
      return;
    }

    if (!mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Request payout'),
        content: Text(
          "We'll transfer your full unpaid session earnings to your UPI ID "
          '$upiId. You can request a payout once a week. This can take up '
          'to 48 hours.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Request'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _withdrawing = true);
    try {
      await ref.read(payoutsApiProvider).requestPayout();
      ref.invalidate(walletBalanceProvider);
      ref.invalidate(walletLedgerProvider);
      ref.invalidate(mentorPayoutsProvider);
      if (!mounted) return;
      showAppSnackBar(context, 'Payout requested');
    } catch (e) {
      if (!mounted) return;
      final message = e is DioException
          ? ((e.response?.data as Map<String, dynamic>?)?['message']
                    as String? ??
                e.message ??
                '$e')
          : '$e';
      showAppSnackBar(context, message);
    } finally {
      if (mounted) setState(() => _withdrawing = false);
    }
  }

  void _showTopupSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Top up wallet',
              style: TextStyle(
                fontSize: AppFont.lg,
                fontWeight: AppFont.extraBold,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            const Text(
              'Uniminutes are your talk time. Pick a recharge pack — bigger '
              'packs give more Uniminutes per rupee.',
              style: TextStyle(
                fontSize: AppFont.xs,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            // Fixed recharge packages — must match the backend's
            // RECHARGE_PACKAGES exactly (any other amount is rejected).
            // iOS shows the marked-up price list; Android the base one.
            ..._rechargePackagesForPlatform.map((pack) {
              return Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: OutlinedButton(
                  onPressed: () {
                    Navigator.of(sheetContext).pop();
                    _startTopup(pack.rupees * 100);
                  },
                  style: OutlinedButton.styleFrom(
                    alignment: Alignment.centerLeft,
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: AppSpacing.sm,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        pack.name,
                        style: const TextStyle(
                          fontWeight: AppFont.bold,
                          fontSize: AppFont.sm,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '₹${pack.rupees}',
                            style: const TextStyle(fontWeight: AppFont.bold),
                          ),
                          Text(
                            uniminutesLabel(pack.uniminutes),
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        pack.tagline,
                        style: const TextStyle(
                          fontSize: AppFont.xs,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
            if (Platform.isIOS) ...[
              const SizedBox(height: AppSpacing.xs),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: const Color(0xFFFBE9C9),
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.info_outline_rounded,
                      size: 18,
                      color: AppColors.textSecondary,
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    const Expanded(
                      child: Text(
                        "Prices include Apple's 30% service fee. To avoid "
                        'this fee, top up your wallet from the Uniscope '
                        'Android app instead.',
                        style: TextStyle(
                          fontSize: AppFont.xs,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.xs),
            Align(
              alignment: Alignment.center,
              child: TextButton(
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  openLegalPage(context, LegalPage.refund);
                },
                child: const Text(
                  'Refund & Cancellation Policy',
                  style: TextStyle(
                    fontSize: AppFont.xs,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isMentor =
        ref.watch(authControllerProvider).user?.role == UserRole.mentor;
    final balanceAsync = ref.watch(walletBalanceProvider);
    final ledgerAsync = ref.watch(walletLedgerProvider);
    final payoutsAsync = isMentor ? ref.watch(mentorPayoutsProvider) : null;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: GradientAppBar(title: const Text('Wallet')),
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            ref.invalidate(walletBalanceProvider);
            ref.invalidate(walletLedgerProvider);
            if (isMentor) ref.invalidate(mentorPayoutsProvider);
          },
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.lg),
                decoration: BoxDecoration(
                  gradient: AppGradients.brand,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  boxShadow: AppShadows.raised,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Text(
                          'Balance',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: AppFont.sm,
                          ),
                        ),
                        const Spacer(),
                        Icon(
                          Icons.account_balance_wallet_rounded,
                          color: Colors.white.withValues(alpha: 0.5),
                          size: 20,
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    balanceAsync.when(
                      loading: () => const SizedBox(
                        height: 28,
                        width: 28,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      ),
                      error: (e, _) => const Text(
                        '—',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: AppFont.display,
                          fontWeight: AppFont.extraBold,
                        ),
                      ),
                      // Aspirants think in Uniminutes; only mentors, who
                      // withdraw to a real bank account, ever see rupees.
                      data: (wallet) => Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Text(
                                isMentor
                                    ? '₹${wallet.balanceRupees.toStringAsFixed(2)}'
                                    : '${wallet.balanceUniminutes}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: AppFont.display,
                                  fontWeight: AppFont.extraBold,
                                ),
                              ),
                              if (!isMentor) ...[
                                const SizedBox(width: 6),
                                const Text(
                                  'Uniminutes',
                                  style: TextStyle(
                                    color: Colors.white70,
                                    fontSize: AppFont.md,
                                    fontWeight: AppFont.semibold,
                                  ),
                                ),
                              ],
                            ],
                          ),
                          if (!isMentor && wallet.reservedMinor > 0) ...[
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Icon(
                                  Icons.lock_clock_rounded,
                                  size: 13,
                                  color: Colors.white.withValues(alpha: 0.75),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  '${uniminutesLabel(wallet.reservedUniminutes)} '
                                  'reserved for a pending call · '
                                  '${wallet.availableUniminutes} available',
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.75),
                                    fontSize: AppFont.xs,
                                    fontWeight: AppFont.medium,
                                  ),
                                ),
                              ],
                            ),
                          ],
                          if (!isMentor &&
                              wallet.availableUniminutes >=
                                  kCallSlotMinutes.first) ...[
                            const SizedBox(height: AppSpacing.sm),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.sm,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.14),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                '≈ ${wallet.availableUniminutes ~/ kCallSlotMinutes.first} '
                                'calls left at ${kCallSlotMinutes.first} min each',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: AppFont.xs,
                                  fontWeight: AppFont.semibold,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    SizedBox(
                      width: double.infinity,
                      child: isMentor
                          ? FilledButton.icon(
                              style: FilledButton.styleFrom(
                                backgroundColor: Colors.white,
                                foregroundColor: AppColors.primaryDark,
                              ),
                              onPressed: _withdrawing
                                  ? null
                                  : _requestWithdrawal,
                              icon: _withdrawing
                                  ? const SizedBox(
                                      height: 18,
                                      width: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(
                                      Icons.account_balance_rounded,
                                      size: 20,
                                    ),
                              label: const Text('Withdraw'),
                            )
                          : FilledButton.icon(
                              style: FilledButton.styleFrom(
                                backgroundColor: Colors.white,
                                foregroundColor: AppColors.primaryDark,
                              ),
                              onPressed: _toppingUp ? null : _showTopupSheet,
                              icon: _toppingUp
                                  ? const SizedBox(
                                      height: 18,
                                      width: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.add_rounded, size: 20),
                              label: const Text('Top Up'),
                            ),
                    ),
                  ],
                ),
              ),
              if (isMentor && payoutsAsync != null) ...[
                const SizedBox(height: AppSpacing.lg),
                const SectionHeader(title: 'Payout requests'),
                const SizedBox(height: AppSpacing.sm),
                payoutsAsync.when(
                  loading: () => const SkeletonCard(),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (payouts) => payouts.isEmpty
                      ? const Padding(
                          padding: EdgeInsets.only(bottom: AppSpacing.sm),
                          child: EmptyState(
                            icon: Icons.account_balance_rounded,
                            title: 'No payouts yet',
                            message:
                                'Request a withdrawal once you have earnings.',
                          ),
                        )
                      : Column(
                          children: payouts
                              .map((p) => _PayoutRow(payout: p))
                              .toList(),
                        ),
                ),
              ],
              // "This month" is scoped to whatever page of the ledger is
              // currently loaded (the default first page, ~20 entries) —
              // not a true all-time aggregate. Cheap and accurate for the
              // vast majority of aspirants (call volume is naturally low);
              // a heavy account with >1 page of activity this month would
              // undercount. A real fix would be a dedicated backend summary
              // endpoint — not built here, this reuses data already fetched.
              if (!isMentor)
                ledgerAsync.maybeWhen(
                  data: (entries) => entries.isEmpty
                      ? const SizedBox.shrink()
                      : Padding(
                          padding: const EdgeInsets.only(
                            top: AppSpacing.lg,
                          ),
                          child: _MonthlyStatsRow(entries: entries),
                        ),
                  orElse: () => const SizedBox.shrink(),
                ),
              const SizedBox(height: AppSpacing.lg),
              const SectionHeader(title: 'Recent activity'),
              const SizedBox(height: AppSpacing.sm),
              ledgerAsync.when(
                loading: () =>
                    const Column(children: [SkeletonCard(), SkeletonCard()]),
                error: (e, _) => const Padding(
                  padding: EdgeInsets.all(AppSpacing.lg),
                  child: EmptyState(
                    icon: Icons.wifi_off_rounded,
                    title: 'Could not load activity',
                    message: 'Pull to refresh to try again.',
                  ),
                ),
                data: (entries) => entries.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.only(top: AppSpacing.lg),
                        child: EmptyState(
                          icon: Icons.receipt_long_rounded,
                          title: 'No activity yet',
                          message:
                              'Top-ups and session payments will show up here.',
                        ),
                      )
                    : Column(children: _groupedLedgerRows(entries, isMentor)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Builds the "Recent activity" list as day-grouped headers + rows —
/// entries already arrive newest-first from the backend, so a single pass
/// inserting a header whenever the calendar day changes is enough.
List<Widget> _groupedLedgerRows(List<LedgerEntry> entries, bool isMentor) {
  final widgets = <Widget>[];
  DateTime? lastDay;
  for (final entry in entries) {
    final local = entry.createdAtLocal;
    final dayOnly = DateTime(local.year, local.month, local.day);
    if (lastDay == null || dayOnly != lastDay) {
      widgets.add(_DayHeader(label: _dayGroupLabel(local)));
      lastDay = dayOnly;
    }
    widgets.add(_LedgerRow(entry: entry, asRupees: isMentor));
  }
  return widgets;
}

class _DayHeader extends StatelessWidget {
  const _DayHeader({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(2, AppSpacing.md, 2, AppSpacing.xs),
      child: Text(
        label.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: AppFont.bold,
          letterSpacing: 0.3,
          color: AppColors.textMuted,
        ),
      ),
    );
  }
}

/// "N Uniminutes spent this month / N calls this month" — a quick-glance
/// summary computed client-side from whatever ledger page is already
/// loaded (see the caller's own note on why this isn't a true all-time
/// aggregate).
class _MonthlyStatsRow extends StatelessWidget {
  const _MonthlyStatsRow({required this.entries});
  final List<LedgerEntry> entries;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    var spentUniminutes = 0;
    var calls = 0;
    for (final entry in entries) {
      final local = entry.createdAtLocal;
      if (local.year != now.year || local.month != now.month) continue;
      if (entry.type == 'SESSION_DEBIT') {
        spentUniminutes += minorToUniminutes(entry.amountMinor.abs());
        calls += 1;
      }
    }
    return Row(
      children: [
        Expanded(
          child: _StatCard(
            value: '$spentUniminutes',
            label: 'Uniminutes spent this month',
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(child: _StatCard(value: '$calls', label: 'Calls this month')),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: const TextStyle(
              fontSize: AppFont.lg,
              fontWeight: AppFont.extraBold,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _LedgerRow extends StatelessWidget {
  const _LedgerRow({required this.entry, required this.asRupees});

  /// Mentor ledgers are real money owed to them; aspirant ledgers are
  /// Uniminutes spent and topped up.
  final bool asRupees;
  final LedgerEntry entry;

  bool get _isNoShow => entry.note?.contains('No-show') ?? false;

  /// Null when there's no counterpart, or the counterpart's account has
  /// since been GDPR-erased (UsersService.eraseUser sets displayName to the
  /// anonymized `deleted_user_<id8>` stub — real, not a bug, but not
  /// something to surface verbatim to a student).
  String? get _friendlyCounterpart {
    final name = entry.counterpartName;
    if (name == null || name.startsWith('deleted_user_')) return null;
    return name;
  }

  String get _title {
    switch (entry.type) {
      case 'TOPUP':
        return 'Wallet recharge';
      case 'SESSION_DEBIT':
        if (_isNoShow) return 'Missed call fee';
        if (_friendlyCounterpart != null) return 'Call with $_friendlyCounterpart';
        return 'Session payment';
      case 'SESSION_CREDIT':
        if (_isNoShow) return 'Missed-call compensation';
        if (_friendlyCounterpart != null) {
          return asRupees ? 'Call with $_friendlyCounterpart' : 'Session earnings';
        }
        return 'Session earnings';
      case 'REFUND':
        return 'Refund';
      case 'PAYOUT':
        return 'Withdrawal';
      case 'ADJUSTMENT':
        return 'Balance adjustment';
      default:
        return entry.type;
    }
  }

  /// The rupees actually paid, parsed straight out of the backend's own
  /// ledger-entry note (something like "Razorpay order X — paid 32500
  /// minor, credited 10 Uniminutes" — see WalletService.applyLedgerEntry's
  /// TOPUP calls). Used to be reverse-inferred from the credited Uniminutes via
  /// the package list, which broke once the same Uniminute credit could
  /// come from two different prices (the 2026-09-24 iOS 30% markup) — a
  /// past top-up's real paid amount is unambiguous, so read it from the
  /// one place that actually recorded it instead of guessing.
  int? get _paidRupees {
    final match = RegExp(r'paid (\d+) minor').firstMatch(entry.note ?? '');
    if (match == null) return null;
    return int.parse(match.group(1)!) ~/ 100;
  }

  String get _subtitle {
    final time = clockLabel(entry.createdAtLocal);
    if (entry.type == 'TOPUP' && !asRupees) {
      final paid = _paidRupees;
      final credited = uniminutesLabel(minorToUniminutes(entry.amountMinor));
      return paid != null
          ? '₹$paid → $credited · $time'
          : '$credited · $time';
    }
    if (_isNoShow) {
      final detail = entry.note!.contains('waited')
          ? "Mentor waited, you didn't join"
          : "Aspirant didn't join";
      return '$detail · $time';
    }
    if (entry.callSlotMinutes != null) {
      return '${entry.callSlotMinutes} min · $time';
    }
    return time;
  }

  @override
  Widget build(BuildContext context) {
    final isCredit = entry.amountMinor >= 0;
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              // A solid pastel tint reads clearer at this size than the
              // faint 10%-alpha wash this used to be.
              color: isCredit
                  ? const Color(0xFFE7F6EC)
                  : const Color(0xFFFBE9EA),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isCredit
                  ? Icons.arrow_downward_rounded
                  : Icons.arrow_upward_rounded,
              size: 18,
              color: isCredit ? AppColors.success : AppColors.error,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _title,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: AppFont.bold,
                    fontSize: AppFont.sm,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _subtitle,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: AppFont.xs,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Text(
            asRupees
                ? '${isCredit ? '+' : ''}₹${entry.amountRupees.toStringAsFixed(2)}'
                : '${isCredit ? '+' : '-'}'
                      '${uniminutesLabel(minorToUniminutes(entry.amountMinor.abs()))}',
            style: TextStyle(
              fontWeight: AppFont.extraBold,
              fontSize: AppFont.sm,
              color: isCredit ? AppColors.success : AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _PayoutRow extends StatelessWidget {
  const _PayoutRow({required this.payout});
  final PayoutRequest payout;

  Color get _statusColor {
    switch (payout.status) {
      case 'COMPLETED':
        return AppColors.success;
      case 'FAILED':
        return AppColors.error;
      default:
        return AppColors.warning;
    }
  }

  String get _statusLabel {
    if (payout.isOverdue) return '${payout.status} (overdue)';
    return payout.status;
  }

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '₹${payout.amountRupees.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontWeight: AppFont.extraBold,
                    fontSize: AppFont.sm,
                  ),
                ),
                if (payout.bankReference != null)
                  Text(
                    'Ref: ${payout.bankReference}',
                    style: const TextStyle(
                      fontSize: AppFont.xs,
                      color: AppColors.textSecondary,
                    ),
                  ),
              ],
            ),
          ),
          StatusChip(label: _statusLabel, color: _statusColor),
        ],
      ),
    );
  }
}
