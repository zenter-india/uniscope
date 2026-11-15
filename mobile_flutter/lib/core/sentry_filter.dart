import 'dart:io' show HandshakeException, SocketException;

import 'package:dio/dio.dart';
import 'package:flutter/services.dart' show PlatformException;
import 'package:sentry_flutter/sentry_flutter.dart';

/// `beforeSend` hook: keeps Sentry's issue list about things we can fix.
///
/// - A user declining a camera / photo / notification permission is their
///   choice, not a bug — dropped (Sentry UNISCOPE-MOBILE-Q, C, A).
/// - Connectivity failures (offline, dropped TLS, aborted download) are a
///   fact of mobile networks. They are kept, but as `warning`, so a real
///   outage is still visible in Sentry without each one paging the
///   "high priority issues" alert (UNISCOPE-MOBILE-3, 17, E, F).
///
/// Everything else passes through unchanged.
SentryEvent? filterSentryEvent(SentryEvent event, Hint hint) {
  final error = event.throwable;
  if (error == null) return event;
  if (_isUserDeniedPermission(error)) return null;
  if (_isConnectivityError(error)) {
    event.level = SentryLevel.warning;
  }
  return event;
}

bool _isUserDeniedPermission(Object error) {
  if (error is! PlatformException) return false;
  final code = error.code.toLowerCase();
  final message = (error.message ?? '').toLowerCase();
  return code.contains('denied') ||
      message.contains('did not allow') ||
      message.contains('not authorized');
}

bool _isConnectivityError(Object error) {
  if (error is SocketException || error is HandshakeException) return true;
  if (error is DioException) {
    return const {
      DioExceptionType.connectionError,
      DioExceptionType.connectionTimeout,
      DioExceptionType.sendTimeout,
      DioExceptionType.receiveTimeout,
    }.contains(error.type);
  }
  // package:http's ClientException (a transitive dependency, so matched by
  // name rather than imported) — what a dropped avatar download throws.
  if (error.runtimeType.toString() == 'ClientException') {
    return error.toString().toLowerCase().contains('connection');
  }
  return false;
}
