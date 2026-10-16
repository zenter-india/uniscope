import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_storekit/in_app_purchase_storekit.dart'
    show InAppPurchaseStoreKitPlatform;
import 'package:in_app_purchase_storekit/store_kit_2_wrappers.dart'
    show SK2Transaction;

/// The 4 Apple IAP product ids, index-matched against wallet_screen.dart's
/// `_kRechargePackages` ([10, 20, 40, 60] Uniminutes in that order) — must
/// stay in sync with the backend's `APPLE_PRODUCT_PACKAGES`
/// (create-topup.dto equivalent for Apple). Named by Uniminute count, not
/// rupee price, so they never need renaming if a price tier shifts.
const List<String> kAppleTopupProductIds = [
  'com.uniscope.uniscopeMobile.uniminutes10',
  'com.uniscope.uniscopeMobile.uniminutes20',
  'com.uniscope.uniscopeMobile.uniminutes40',
  'com.uniscope.uniscopeMobile.uniminutes60',
];

/// Wraps the `in_app_purchase` plugin's StoreKit purchase flow for iOS
/// wallet top-ups. Kept as its own class rather than inlined into
/// wallet_screen.dart — the purchase-stream-subscription lifecycle here is a
/// materially different shape from Razorpay Checkout's fire-and-forget
/// `.open()` call, mirroring how wallet_api.dart already separates
/// "talk to the backend" from "drive the UI".
///
/// Android is untouched — this class is only ever constructed when
/// `Platform.isIOS`.
class AppleIapService {
  final InAppPurchase _iap = InAppPurchase.instance;
  StreamSubscription<List<PurchaseDetails>>? _subscription;

  /// Queries the real product details (price, currency) from StoreKit for
  /// the 4 known product ids. A product missing from the response (e.g. not
  /// yet created in App Store Connect) is simply absent from the returned
  /// list — callers should render only the products that came back rather
  /// than assuming all 4 are present.
  Future<List<ProductDetails>> loadProducts() async {
    final available = await _iap.isAvailable();
    if (!available) {
      throw Exception('The App Store is not available on this device right now');
    }
    final response = await _iap.queryProductDetails(kAppleTopupProductIds.toSet());
    if (response.error != null) {
      throw Exception(response.error!.message);
    }
    return response.productDetails;
  }

  /// The App Store storefront country StoreKit is actually quoting prices
  /// for (ISO 3166-1 alpha-3, e.g. "IND"/"USA"), or '' if it can't be read.
  /// Diagnostic only — see wallet_screen.dart's store-diagnostic line.
  Future<String> storefrontCountry() async {
    try {
      return await _iap.countryCode();
    } catch (_) {
      return '';
    }
  }

  /// Uniminute top-ups are consumable — repeatable purchases, never a
  /// non-consumable/subscription. `autoConsume: true` is StoreKit's default
  /// for exactly this case.
  Future<bool> buy(ProductDetails product) {
    final param = PurchaseParam(productDetails: product);
    return _iap.buyConsumable(purchaseParam: param, autoConsume: true);
  }

  /// Subscribes to the purchase stream. Safe to call more than once — a
  /// prior subscription is cancelled first, since the underlying stream
  /// throws if `.listen()` is ever called twice on the same active
  /// subscription.
  void listen({
    required Future<void> Function(PurchaseDetails purchase) onVerified,
    required void Function(String message) onError,
    required VoidCallback onCancelled,
  }) {
    _subscription?.cancel();
    _subscription = _iap.purchaseStream.listen(
      (purchases) async {
        for (final purchase in purchases) {
          switch (purchase.status) {
            case PurchaseStatus.pending:
              break;
            case PurchaseStatus.purchased:
            case PurchaseStatus.restored:
              await onVerified(purchase);
              break;
            case PurchaseStatus.error:
              onError(purchase.error?.message ?? 'Purchase failed');
              break;
            case PurchaseStatus.canceled:
              onCancelled();
              break;
          }
        }
      },
      onError: (Object error) => onError('$error'),
    );
  }

  /// Every top-up transaction StoreKit still holds as unfinished — paid for,
  /// but never finished because the server never confirmed it (bad config,
  /// network, the app closed mid-flow, …). An unfinished transaction blocks
  /// buying the same pack again (`storekit_duplicate_product_object`).
  ///
  /// Read straight from StoreKit 2's `Transaction.unfinished` rather than
  /// waiting for the purchase stream: that stream (`Transaction.updates`)
  /// hands unfinished transactions over only once per app launch, so if that
  /// one delivery failed, nothing retries until the app is relaunched.
  Future<List<({String id, String productId, String jws})>>
  unfinishedTopups() async {
    if (!InAppPurchaseStoreKitPlatform.isStoreKit2Enabled) return const [];
    final txs = await SK2Transaction.unfinishedTransactions().timeout(
      const Duration(seconds: 10),
    );
    return [
      for (final t in txs)
        if (kAppleTopupProductIds.contains(t.productId) &&
            (t.receiptData ?? '').isNotEmpty)
          (id: t.id, productId: t.productId, jws: t.receiptData!),
    ];
  }

  /// Finishes a transaction found by [unfinishedTopups]. Time-limited: the
  /// plugin's native `finish` never answers if StoreKit can't find the
  /// transaction, and an un-bounded await would freeze the caller.
  Future<void> finishTransaction(String id) =>
      SK2Transaction.finish(int.parse(id)).timeout(const Duration(seconds: 8));

  /// Finishes a transaction delivered on the purchase stream (same
  /// time-limit reason as [finishTransaction]).
  Future<void> completePurchase(PurchaseDetails purchase) =>
      _iap.completePurchase(purchase).timeout(const Duration(seconds: 8));

  void dispose() {
    _subscription?.cancel();
    _subscription = null;
  }
}
