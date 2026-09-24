import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

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

  void dispose() {
    _subscription?.cancel();
    _subscription = null;
  }
}
