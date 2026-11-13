import 'package:dio/dio.dart';

/// `code` the backend puts on a 403 when an admin has switched off the
/// action for this account (see `assertPermission` in the backend).
const kPermissionDeniedCode = 'PERMISSION_DENIED';

Map<String, dynamic>? _body(Object e) {
  if (e is DioException) {
    final data = e.response?.data;
    if (data is Map) return Map<String, dynamic>.from(data);
  }
  return null;
}

/// True when the backend refused the action because an admin has turned off
/// this permission for the user.
bool isPermissionDenied(Object e) {
  final body = _body(e);
  if (body == null) return false;
  if (body['code'] == kPermissionDeniedCode) return true;
  // Some Nest exception shapes nest the payload under `message`.
  final msg = body['message'];
  return msg is Map && msg['code'] == kPermissionDeniedCode;
}

/// A short, human-readable reason for a failed API call: the backend's own
/// `message` when there is one, otherwise [fallback] — never Dio's raw
/// "DioException [bad response]…" text.
String friendlyApiError(Object e, {String fallback = 'Something went wrong.'}) {
  final body = _body(e);
  if (body != null) {
    var msg = body['message'];
    if (msg is Map) msg = msg['message'];
    if (msg is List && msg.isNotEmpty) msg = msg.first;
    if (msg is String && msg.trim().isNotEmpty) return msg.trim();
  }
  if (e is DioException) {
    return switch (e.type) {
      DioExceptionType.connectionError ||
      DioExceptionType.connectionTimeout ||
      DioExceptionType.sendTimeout ||
      DioExceptionType.receiveTimeout =>
        'Check your connection and try again.',
      _ => fallback,
    };
  }
  final s = e.toString();
  const prefix = 'Exception: ';
  final stripped = s.startsWith(prefix) ? s.substring(prefix.length) : s;
  return stripped.trim().isEmpty ? fallback : stripped.trim();
}
