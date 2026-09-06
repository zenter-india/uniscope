import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

/// Best-effort platform tag for a technical report — the backend DTO only
/// accepts 'android' | 'ios' | 'web', so anything else is sent as null.
String? currentPlatformTag() {
  if (kIsWeb) return 'web';
  switch (defaultTargetPlatform) {
    case TargetPlatform.android:
      return 'android';
    case TargetPlatform.iOS:
      return 'ios';
    default:
      return null;
  }
}

class SupportApi {
  SupportApi(this._dio);

  final Dio _dio;

  /// Files a "Report a technical issue" submission from the Help Centre.
  /// Lands in the admin panel's Support → Technical reports queue.
  Future<void> submitTechnicalReport({
    required String message,
    String? platform,
    String? appVersion,
  }) async {
    await _dio.post<void>(
      '/support/technical-reports',
      data: {
        'message': message.trim(),
        'platform': ?platform,
        if (appVersion != null && appVersion.isNotEmpty)
          'appVersion': appVersion,
      },
    );
  }
}

final supportApiProvider = Provider<SupportApi>(
  (ref) => SupportApi(ref.watch(dioProvider)),
);
