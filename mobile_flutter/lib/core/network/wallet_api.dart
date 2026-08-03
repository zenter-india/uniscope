import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

/// Minor units in one Uniminute — mirrors the backend's Uniminute
/// conversion. 1 Uniminute = 1000 minor units = one minute of mentor call
/// time, so a balance in Uniminutes reads directly as "minutes I can talk".
const int kMinorUnitsPerUniminute = 1000;

/// Uniminutes are the ONLY unit shown to students outside the top-up sheet.
/// Rupees appear at top-up and nowhere else — see the pricing decision in
/// CLAUDE.md. Floor rather than round: never tell someone they have a
/// minute they can't actually spend.
int minorToUniminutes(int minor) => minor ~/ kMinorUnitsPerUniminute;

/// Uniminutes a fixed call slot costs. Slots are priced at exactly one
/// Uniminute per minute, so this is the identity — it exists so the
/// relationship is stated once instead of assumed at each call site.
int slotUniminutes(int slotMinutes) => slotMinutes;

String uniminutesLabel(int count) =>
    count == 1 ? '1 Uniminute' : '$count Uniminutes';

class Wallet {
  const Wallet({required this.id, required this.balanceMinor});

  final String id;
  final int balanceMinor;

  /// Student-facing balance. This is what the wallet screen shows.
  int get balanceUniminutes => minorToUniminutes(balanceMinor);

  /// Rupee value — mentor earnings and payouts only. Never render this on
  /// an aspirant surface outside the top-up sheet.
  double get balanceRupees => balanceMinor / 100;

  factory Wallet.fromJson(Map<String, dynamic> json) => Wallet(
        id: json['id'] as String,
        balanceMinor: (json['balanceMinor'] as num).toInt(),
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
    return data.map((e) => LedgerEntry.fromJson(e as Map<String, dynamic>)).toList();
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
