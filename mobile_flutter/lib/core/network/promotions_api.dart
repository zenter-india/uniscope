import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

/// An admin "promotion" waiting to be shown to this user as a popup (UNI-58).
class PendingPromotion {
  const PendingPromotion({
    required this.id,
    required this.title,
    this.body,
    this.linkUrl,
    this.linkLabel,
    this.creditedMinor = 0,
  });

  final String id;
  final String title;
  final String? body;

  /// An https link the popup offers as a button, or null.
  final String? linkUrl;
  final String? linkLabel;

  /// What this promotion added to THIS user's wallet, in minor units
  /// (0 = nothing). Uniminutes for a student (1000 minor each), rupees for a
  /// mentor (100 minor each) — the wallet screen shows the same units.
  final int creditedMinor;

  factory PendingPromotion.fromJson(Map<String, dynamic> json) {
    String? text(String key) {
      final v = json[key];
      return v is String && v.trim().isNotEmpty ? v.trim() : null;
    }

    return PendingPromotion(
      id: json['id'] as String,
      title: json['title'] as String,
      body: text('body'),
      linkUrl: text('linkUrl'),
      linkLabel: text('linkLabel'),
      creditedMinor: (json['creditedMinor'] as num?)?.toInt() ?? 0,
    );
  }

  /// The link as a safe, openable address, or null. Only https is ever
  /// opened, whatever the server says: a promotion must never be able to
  /// launch another app or a local file from a phone.
  Uri? get safeLink {
    final raw = linkUrl;
    if (raw == null) return null;
    final uri = Uri.tryParse(raw);
    if (uri == null || uri.scheme != 'https' || uri.host.isEmpty) return null;
    return uri;
  }
}

class PromotionsApi {
  PromotionsApi(this._dio);

  final Dio _dio;

  /// Promotions this user hasn't been shown yet, newest first.
  Future<List<PendingPromotion>> pending() async {
    final res = await _dio.get<List<dynamic>>('/promotions/pending');
    return (res.data ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(PendingPromotion.fromJson)
        .toList();
  }

  /// Tells the server the popup was shown, so it never comes back.
  Future<void> markSeen(String id) async {
    await _dio.post<void>('/promotions/$id/seen');
  }
}

final promotionsApiProvider = Provider<PromotionsApi>(
  (ref) => PromotionsApi(ref.watch(dioProvider)),
);
