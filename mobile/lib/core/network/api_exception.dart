import 'package:dio/dio.dart';

/// Typed error surfaced to controllers/UI. Prefers the server's
/// `{ "message": ... }` (NestJS error shape), matching the RN client's
/// `err.response.data.message` fallback.
class ApiException implements Exception {
  const ApiException({required this.message, this.statusCode});

  final String message;
  final int? statusCode;

  bool get isUnauthorized => statusCode == 401;
  bool get isRateLimited => statusCode == 429;

  factory ApiException.fromDio(DioException e) {
    final status = e.response?.statusCode;
    final data = e.response?.data;

    String message;
    if (data is Map && data['message'] != null) {
      final m = data['message'];
      message = m is List ? m.join(', ') : m.toString();
    } else if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      message = 'The request timed out. Check your connection and try again.';
    } else if (e.type == DioExceptionType.connectionError) {
      message = 'Could not reach the server. Check your connection.';
    } else {
      message = 'Something went wrong. Please try again.';
    }

    return ApiException(message: message, statusCode: status);
  }

  @override
  String toString() => 'ApiException($statusCode, $message)';
}
