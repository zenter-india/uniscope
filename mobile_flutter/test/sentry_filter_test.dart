import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:uniscope_mobile/core/sentry_filter.dart';

SentryEvent? _filter(Object error) =>
    filterSentryEvent(SentryEvent(throwable: error), Hint());

void main() {
  test('drops a user-denied permission', () {
    expect(
      _filter(PlatformException(
        code: 'camera_access_denied',
        message: 'The user did not allow camera access.',
      )),
      isNull,
    );
    expect(
      _filter(PlatformException(
        code: 'Error 2003',
        message: 'Repository could not save notification. Source is not authorized.',
      )),
      isNull,
    );
  });

  test('keeps connectivity errors but downgrades them to warning', () {
    final dio = DioException(
      requestOptions: RequestOptions(path: '/x'),
      type: DioExceptionType.connectionError,
    );
    for (final error in [dio, const SocketException('abort')]) {
      expect(_filter(error)?.level, SentryLevel.warning);
    }
  });

  test('passes real errors through untouched', () {
    final event = SentryEvent(throwable: StateError('boom'));
    expect(filterSentryEvent(event, Hint()), same(event));
    // A PlatformException that is not a permission denial still reports.
    expect(
      _filter(PlatformException(code: 'channel-error', message: 'nope')),
      isNotNull,
    );
    // A Dio error carrying a real server response is not connectivity.
    final badResponse = DioException(
      requestOptions: RequestOptions(path: '/x'),
      type: DioExceptionType.badResponse,
    );
    expect(_filter(badResponse)?.level, isNot(SentryLevel.warning));
  });
}
