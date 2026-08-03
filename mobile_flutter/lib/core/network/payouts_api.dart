import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

class PayoutRequest {
  const PayoutRequest({
    required this.id,
    required this.amountMinor,
    required this.status,
    required this.createdAt,
    required this.isOverdue,
    this.bankReference,
    this.processedAt,
  });

  final String id;
  final int amountMinor;
  final String status;
  final DateTime createdAt;
  final DateTime? processedAt;
  final String? bankReference;
  final bool isOverdue;

  double get amountRupees => amountMinor / 100;

  factory PayoutRequest.fromJson(Map<String, dynamic> json) => PayoutRequest(
        id: json['id'] as String,
        amountMinor: (json['amountMinor'] as num).toInt(),
        status: json['status'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        processedAt: json['processedAt'] != null
            ? DateTime.parse(json['processedAt'] as String)
            : null,
        bankReference: json['bankReference'] as String?,
        isOverdue: json['isOverdue'] as bool? ?? false,
      );
}

class PayoutsApi {
  PayoutsApi(this._dio);

  final Dio _dio;

  /// Amount is always server-derived from unpaid SESSION_CREDIT ledger
  /// history — never mentor-chosen. Throws (via DioException) if under the
  /// ₹200 minimum.
  Future<PayoutRequest> requestPayout() async {
    final res = await _dio.post<Map<String, dynamic>>('/payouts');
    return PayoutRequest.fromJson(res.data!);
  }

  Future<List<PayoutRequest>> listMine() async {
    final res = await _dio.get<List<dynamic>>('/payouts/mine');
    return res.data!.map((e) => PayoutRequest.fromJson(e as Map<String, dynamic>)).toList();
  }
}

final payoutsApiProvider = Provider<PayoutsApi>(
  (ref) => PayoutsApi(ref.watch(dioProvider)),
);
