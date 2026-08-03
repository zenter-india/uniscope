import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

/// Mirrors backend `ReportTargetType` — see backend/prisma/schema.prisma.
enum ReportTargetType { session, review, message, user }

extension ReportTargetTypeValue on ReportTargetType {
  String get apiValue => switch (this) {
        ReportTargetType.session => 'SESSION',
        ReportTargetType.review => 'REVIEW',
        ReportTargetType.message => 'MESSAGE',
        ReportTargetType.user => 'USER',
      };
}

/// Mirrors backend `ReportReason`. Labels are the mobile-facing copy shown
/// in the report sheet's reason picker.
enum ReportReason {
  spam,
  harassment,
  impersonation,
  inappropriate,
  abusiveLanguage,
  offPlatformPaymentRequest,
  other,
}

extension ReportReasonValue on ReportReason {
  String get apiValue => switch (this) {
        ReportReason.spam => 'SPAM',
        ReportReason.harassment => 'HARASSMENT',
        ReportReason.impersonation => 'IMPERSONATION',
        ReportReason.inappropriate => 'INAPPROPRIATE',
        ReportReason.abusiveLanguage => 'ABUSIVE_LANGUAGE',
        ReportReason.offPlatformPaymentRequest => 'OFF_PLATFORM_PAYMENT_REQUEST',
        ReportReason.other => 'OTHER',
      };

  String get label => switch (this) {
        ReportReason.spam => 'Spam',
        ReportReason.harassment => 'Harassment or bullying',
        ReportReason.impersonation => 'Impersonation',
        ReportReason.inappropriate => 'Inappropriate content',
        ReportReason.abusiveLanguage => 'Abusive language',
        ReportReason.offPlatformPaymentRequest => 'Asked to pay/contact outside the app',
        ReportReason.other => 'Something else',
      };
}

class ReportsApi {
  ReportsApi(this._dio);

  final Dio _dio;

  Future<void> create({
    required ReportTargetType targetType,
    required String targetId,
    required ReportReason reason,
    String? description,
  }) async {
    await _dio.post<void>('/reports', data: {
      'targetType': targetType.apiValue,
      'targetId': targetId,
      'reason': reason.apiValue,
      if (description != null && description.trim().isNotEmpty)
        'description': description.trim(),
    });
  }
}

final reportsApiProvider = Provider<ReportsApi>(
  (ref) => ReportsApi(ref.watch(dioProvider)),
);
