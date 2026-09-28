import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

enum DocumentType {
  studentId('STUDENT_ID', 'College ID card'),
  // Wire values (STUDENT_PORTAL_SCREENSHOT / NMC_REGISTRATION) are the
  // backend's Prisma DocumentType enum members, validated server-side via
  // @IsEnum — unchanged. Only the user-facing labels were renamed, per
  // screenshot, to match what these documents actually are in practice.
  studentPortalScreenshot('STUDENT_PORTAL_SCREENSHOT', 'Admission order'),
  degreeCertificate('DEGREE_CERTIFICATE', 'Degree certificate'),
  nmcRegistration('NMC_REGISTRATION', 'Registration certificate');

  const DocumentType(this.wire, this.label);
  final String wire;
  final String label;
}

class VerificationRequest {
  const VerificationRequest({
    required this.id,
    required this.universityId,
    required this.documentType,
    required this.status,
    required this.reviewNote,
    required this.submittedAt,
    required this.createdAt,
  });

  final String id;
  final String universityId;
  final String documentType;
  final String status;
  final String? reviewNote;
  final String? submittedAt;
  final String createdAt;

  factory VerificationRequest.fromJson(Map<String, dynamic> json) => VerificationRequest(
        id: json['id'] as String,
        universityId: json['universityId'] as String,
        documentType: json['documentType'] as String,
        status: json['status'] as String,
        reviewNote: json['reviewNote'] as String?,
        submittedAt: json['submittedAt'] as String?,
        createdAt: json['createdAt'] as String,
      );
}

/// Thrown by [VerificationApi.submit] on a 409 — the backend only 409s when
/// the account's verification status is already SUBMITTED / UNDER_REVIEW /
/// VERIFIED (`VerificationService.submit`'s RESUBMITTABLE_STATUSES check),
/// i.e. a request is already on file. A real device report: the mentor
/// onboarding wizard showed a raw "DioException [bad response] … 409" error
/// even though the submission had genuinely landed (visible after logging
/// in, and in the admin panel) — the UI treated "already received" as a
/// failure. Callers should treat this as success.
class AlreadySubmittedException implements Exception {
  const AlreadySubmittedException();
}

class VerificationApi {
  VerificationApi(this._dio);

  final Dio _dio;

  Future<VerificationRequest> submit({
    required String universityId,
    required DocumentType documentType,
    required String documentBase64,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/verification',
        data: {
          'universityId': universityId,
          'documentType': documentType.wire,
          'documentBase64': documentBase64,
        },
      );
      return VerificationRequest.fromJson(res.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 409) {
        throw const AlreadySubmittedException();
      }
      // Surface the backend's own message (string or validation list)
      // instead of DioException.toString()'s status-code boilerplate.
      final data = e.response?.data;
      String? msg;
      if (data is Map) {
        final m = data['message'];
        if (m is String) {
          msg = m;
        } else if (m is List && m.isNotEmpty) {
          msg = m.join('\n');
        }
      }
      if (msg != null && msg.isNotEmpty) throw Exception(msg);
      rethrow;
    }
  }

  Future<List<VerificationRequest>> mine() async {
    final res = await _dio.get<List<dynamic>>('/verification/mine');
    return res.data!.map((e) => VerificationRequest.fromJson(e as Map<String, dynamic>)).toList();
  }
}

final verificationApiProvider = Provider<VerificationApi>(
  (ref) => VerificationApi(ref.watch(dioProvider)),
);

final myVerificationProvider = FutureProvider.autoDispose<List<VerificationRequest>>(
  (ref) => ref.watch(verificationApiProvider).mine(),
);
