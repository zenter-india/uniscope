import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

enum DocumentType {
  studentId('STUDENT_ID', 'College ID card'),
  studentPortalScreenshot('STUDENT_PORTAL_SCREENSHOT', 'Student portal screenshot'),
  degreeCertificate('DEGREE_CERTIFICATE', 'Degree certificate'),
  nmcRegistration('NMC_REGISTRATION', 'NMC / MCI registration');

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

class VerificationApi {
  VerificationApi(this._dio);

  final Dio _dio;

  Future<VerificationRequest> submit({
    required String universityId,
    required DocumentType documentType,
    required String documentBase64,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/verification',
      data: {
        'universityId': universityId,
        'documentType': documentType.wire,
        'documentBase64': documentBase64,
      },
    );
    return VerificationRequest.fromJson(res.data!);
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
