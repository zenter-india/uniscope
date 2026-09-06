import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

/// Minor units in one Uniminute — mirrors the backend's Uniminute
/// conversion (WalletService.UNIMINUTE_VALUE_MINOR). 1 Uniminute = 1000
/// minor units = ₹10 at top-up. Uniminutes are a plain currency unit, not
/// a literal minutes-of-call-time reading — see slotUniminutes below; that
/// equivalence held before the 2026-09-06 tiered call pricing, but no
/// longer does.
const int kMinorUnitsPerUniminute = 1000;

/// Uniminutes are the ONLY unit shown to students outside the top-up sheet.
/// Rupees appear at top-up and nowhere else — see the pricing decision in
/// CLAUDE.md. Floor rather than round: never tell someone they have a
/// minute they can't actually spend.
int minorToUniminutes(int minor) => minor ~/ kMinorUnitsPerUniminute;

/// Uniminutes a fixed call slot costs — mirrors the backend's
/// CALL_SLOT_PRICE_MINOR exactly (kept as a lookup, not computed, so the two
/// can't silently drift). Each slot is a fixed price, not minutes × a flat
/// rate — 10 min → ₹250 (25 Uniminutes), 20 min → ₹400 (40), 40 min → ₹750
/// (75), 60 min → ₹1000 (100). A slot's Uniminute cost no longer equals its
/// minute count (product decision, 2026-09-06, replacing the earlier flat
/// ₹10/min-for-every-slot pricing).
int slotUniminutes(int slotMinutes) {
  const prices = {10: 25, 20: 40, 40: 75, 60: 100};
  final price = prices[slotMinutes];
  if (price == null) {
    throw ArgumentError('No price configured for call slot: $slotMinutes min');
  }
  return price;
}

String uniminutesLabel(int count) =>
    count == 1 ? '1 Uniminute' : '$count Uniminutes';

class Wallet {
  const Wallet({
    required this.id,
    required this.balanceMinor,
    this.reservedMinor = 0,
  });

  final String id;
  final int balanceMinor;

  /// Minor units currently held for a booked-but-not-yet-connected call.
  /// Not spent — released if the call is rejected/cancelled or nobody joins.
  final int reservedMinor;

  /// Total credited balance in Uniminutes (includes anything reserved).
  int get balanceUniminutes => minorToUniminutes(balanceMinor);

  /// Uniminutes held for pending calls — shown on the wallet screen so the
  /// spendable figure below it is never a surprise.
  int get reservedUniminutes => minorToUniminutes(reservedMinor);

  /// What a new call booking can actually draw on: balance minus reserved.
  int get availableUniminutes =>
      minorToUniminutes(balanceMinor - reservedMinor);

  /// Rupee value — mentor earnings and payouts only. Never render this on
  /// an aspirant surface outside the top-up sheet.
  double get balanceRupees => balanceMinor / 100;

  factory Wallet.fromJson(Map<String, dynamic> json) => Wallet(
    id: json['id'] as String,
    balanceMinor: (json['balanceMinor'] as num).toInt(),
    reservedMinor: (json['reservedMinor'] as num?)?.toInt() ?? 0,
  );
}

class LedgerEntry {
  const LedgerEntry({
    required this.id,
    required this.type,
    required this.amountMinor,
    required this.balanceAfterMinor,
    required this.note,
    required this.createdAt,
  });

  final String id;
  final String type;
  final int amountMinor;
  final int balanceAfterMinor;
  final String? note;
  final String createdAt;

  double get amountRupees => amountMinor / 100;

  factory LedgerEntry.fromJson(Map<String, dynamic> json) => LedgerEntry(
    id: json['id'] as String,
    type: json['type'] as String,
    amountMinor: (json['amountMinor'] as num).toInt(),
    balanceAfterMinor: (json['balanceAfterMinor'] as num).toInt(),
    note: json['note'] as String?,
    createdAt: json['createdAt'] as String,
  );
}

class TopupOrder {
  const TopupOrder({
    required this.orderId,
    required this.amountMinor,
    required this.currency,
    required this.keyId,
  });

  final String orderId;
  final int amountMinor;
  final String currency;
  final String keyId;

  factory TopupOrder.fromJson(Map<String, dynamic> json) => TopupOrder(
    orderId: json['orderId'] as String,
    amountMinor: (json['amountMinor'] as num).toInt(),
    currency: json['currency'] as String,
    keyId: json['keyId'] as String,
  );
}

class WalletApi {
  WalletApi(this._dio);

  final Dio _dio;

  Future<Wallet> getBalance() async {
    final res = await _dio.get<Map<String, dynamic>>('/wallet');
    return Wallet.fromJson(res.data!);
  }

  Future<List<LedgerEntry>> getLedger() async {
    final res = await _dio.get<Map<String, dynamic>>('/wallet/ledger');
    final data = res.data!['data'] as List<dynamic>;
    return data
        .map((e) => LedgerEntry.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<TopupOrder> createTopupOrder(int amountMinor) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/wallet/topup',
      data: {'amountMinor': amountMinor},
    );
    return TopupOrder.fromJson(res.data!);
  }

  Future<Wallet> verifyTopup({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/wallet/topup/verify',
      data: {
        'razorpayOrderId': razorpayOrderId,
        'razorpayPaymentId': razorpayPaymentId,
        'razorpaySignature': razorpaySignature,
      },
    );
    return Wallet.fromJson(res.data!);
  }
}

final walletApiProvider = Provider<WalletApi>(
  (ref) => WalletApi(ref.watch(dioProvider)),
);
