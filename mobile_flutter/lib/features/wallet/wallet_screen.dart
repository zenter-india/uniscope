import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../core/network/wallet_api.dart';
import '../../core/theme/app_theme.dart';

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
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Top up wallet',
                style: TextStyle(fontSize: AppFont.lg, fontWeight: AppFont.bold)),
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.sm,
              children: [250, 500, 1000].map((rupees) {
                return OutlinedButton(
                  onPressed: () {
                    Navigator.of(sheetContext).pop();
                    _startTopup(rupees * 100);
                  },
                  child: Text('₹$rupees'),
                );
              }).toList(),
            ),
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
      appBar: AppBar(
        title: const Text('Wallet'),
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
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
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Balance',
                        style: TextStyle(color: Colors.white70, fontSize: AppFont.sm)),
                    const SizedBox(height: AppSpacing.xs),
                    balanceAsync.when(
                      loading: () => const SizedBox(
                        height: 28,
                        width: 28,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      ),
                      error: (e, _) => const Text('—',
                          style: TextStyle(
                              color: Colors.white, fontSize: AppFont.xxl, fontWeight: AppFont.bold)),
                      data: (wallet) => Text(
                        '₹${wallet.balanceRupees.toStringAsFixed(2)}',
                        style: const TextStyle(
                            color: Colors.white, fontSize: AppFont.xxl, fontWeight: AppFont.bold),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: AppColors.primary,
                        ),
                        onPressed: _toppingUp ? null : _showTopupSheet,
                        child: _toppingUp
                            ? const SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(strokeWidth: 2))
                            : const Text('Top Up'),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              const Text('Recent activity',
                  style: TextStyle(fontSize: AppFont.md, fontWeight: AppFont.semibold)),
              const SizedBox(height: AppSpacing.sm),
              ledgerAsync.when(
                loading: () => const Padding(
                  padding: EdgeInsets.all(AppSpacing.lg),
                  child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
                ),
                error: (e, _) => Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Text('Failed to load ledger: $e',
                      style: const TextStyle(color: AppColors.error)),
                ),
                data: (entries) => entries.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.all(AppSpacing.lg),
                        child: Text('No activity yet.',
                            style: TextStyle(color: AppColors.textSecondary)),
                      )
                    : Column(
                        children: entries.map((e) => _LedgerRow(entry: e)).toList(),
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

  @override
  Widget build(BuildContext context) {
    final isCredit = entry.amountMinor >= 0;
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(entry.type,
                    style: const TextStyle(fontWeight: AppFont.semibold, fontSize: AppFont.sm)),
                if (entry.note != null)
                  Text(entry.note!,
                      style: const TextStyle(fontSize: AppFont.xs, color: AppColors.textSecondary)),
              ],
            ),
          ),
          Text(
            '${isCredit ? '+' : ''}₹${entry.amountRupees.toStringAsFixed(2)}',
            style: TextStyle(
              fontWeight: AppFont.semibold,
              color: isCredit ? AppColors.success : AppColors.error,
            ),
          ),
        ],
      ),
    );
  }
}
