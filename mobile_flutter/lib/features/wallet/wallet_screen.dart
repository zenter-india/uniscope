import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../core/network/wallet_api.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/app_widgets.dart';

final walletBalanceProvider = FutureProvider.autoDispose<Wallet>(
  (ref) => ref.watch(walletApiProvider).getBalance(),
);

final walletLedgerProvider = FutureProvider.autoDispose<List<LedgerEntry>>(
  (ref) => ref.watch(walletApiProvider).getLedger(),
);

/// Real wallet screen: balance + ledger from the backend, and a Top Up flow
/// that opens Razorpay's actual Checkout UI (test mode). On success we
/// verify the returned signature server-side and credit the wallet — see
/// WalletService.verifyAndCreditTopup for why (webhook URL isn't publicly
/// reachable from local dev).
class WalletScreen extends ConsumerStatefulWidget {
  const WalletScreen({super.key});

  @override
  ConsumerState<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends ConsumerState<WalletScreen> {
  late final Razorpay _razorpay;
  String? _pendingOrderId;
  bool _toppingUp = false;

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
      final order = await ref.read(walletApiProvider).createTopupOrder(amountMinor);
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
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Could not start top-up: $e')));
    }
  }

  Future<void> _onPaymentSuccess(PaymentSuccessResponse response) async {
    try {
      await ref.read(walletApiProvider).verifyTopup(
            razorpayOrderId: response.orderId ?? _pendingOrderId ?? '',
            razorpayPaymentId: response.paymentId!,
            razorpaySignature: response.signature!,
          );
      ref.invalidate(walletBalanceProvider);
      ref.invalidate(walletLedgerProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Wallet topped up successfully')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Payment succeeded but crediting failed: $e')));
    } finally {
      if (mounted) setState(() => _toppingUp = false);
    }
  }

  void _onPaymentError(PaymentFailureResponse response) {
    setState(() => _toppingUp = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Payment failed: ${response.message}')),
    );
  }

  void _onExternalWallet(ExternalWalletResponse response) {
    setState(() => _toppingUp = false);
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
            const Text('Top up wallet',
                style: TextStyle(
                    fontSize: AppFont.lg, fontWeight: AppFont.extraBold)),
            const SizedBox(height: AppSpacing.xs),
            const Text(
              '₹250 credits 20 minutes of call time.',
              style: TextStyle(
                  fontSize: AppFont.xs, color: AppColors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [250, 500, 1000].map((rupees) {
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(right: AppSpacing.sm),
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.of(sheetContext).pop();
                        _startTopup(rupees * 100);
                      },
                      child: Text('₹$rupees'),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final balanceAsync = ref.watch(walletBalanceProvider);
    final ledgerAsync = ref.watch(walletLedgerProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Wallet')),
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            ref.invalidate(walletBalanceProvider);
            ref.invalidate(walletLedgerProvider);
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
                        const Text('Balance',
                            style: TextStyle(
                                color: Colors.white70, fontSize: AppFont.sm)),
                        const Spacer(),
                        Icon(Icons.account_balance_wallet_rounded,
                            color: Colors.white.withValues(alpha: 0.5),
                            size: 20),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    balanceAsync.when(
                      loading: () => const SizedBox(
                        height: 28,
                        width: 28,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      ),
                      error: (e, _) => const Text('—',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: AppFont.display,
                              fontWeight: AppFont.extraBold)),
                      data: (wallet) => Text(
                        '₹${wallet.balanceRupees.toStringAsFixed(2)}',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: AppFont.display,
                            fontWeight: AppFont.extraBold),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: AppColors.primaryDark,
                        ),
                        onPressed: _toppingUp ? null : _showTopupSheet,
                        icon: _toppingUp
                            ? const SizedBox(
                                height: 18,
                                width: 18,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.add_rounded, size: 20),
                        label: const Text('Top Up'),
                      ),
                    ),
                  ],
                ),
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
                    : Column(
                        children:
                            entries.map((e) => _LedgerRow(entry: e)).toList(),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LedgerRow extends StatelessWidget {
  const _LedgerRow({required this.entry});
  final LedgerEntry entry;

  String get _label {
    switch (entry.type) {
      case 'TOPUP':
        return 'Wallet top-up';
      case 'SESSION_DEBIT':
        return 'Session payment';
      case 'SESSION_CREDIT':
        return 'Session earnings';
      case 'REFUND':
        return 'Refund';
      default:
        return entry.type;
    }
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
              color: (isCredit ? AppColors.success : AppColors.error)
                  .withValues(alpha: 0.1),
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
                Text(_label,
                    style: const TextStyle(
                        fontWeight: AppFont.bold, fontSize: AppFont.sm)),
                if (entry.note != null)
                  Text(entry.note!,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: AppFont.xs,
                          color: AppColors.textSecondary)),
              ],
            ),
          ),
          Text(
            '${isCredit ? '+' : ''}₹${entry.amountRupees.toStringAsFixed(2)}',
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
