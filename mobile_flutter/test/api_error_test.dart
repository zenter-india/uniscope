import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope_mobile/core/network/api_error.dart';

DioException _err(Object? data, {int status = 403}) {
  final req = RequestOptions(path: '/x');
  return DioException(
    requestOptions: req,
    type: DioExceptionType.badResponse,
    response: Response(requestOptions: req, statusCode: status, data: data),
  );
}

void main() {
  group('isPermissionDenied', () {
    test('true for a PERMISSION_DENIED body', () {
      expect(
        isPermissionDenied(
          _err({'code': 'PERMISSION_DENIED', 'message': 'Not allowed'}),
        ),
        isTrue,
      );
    });

    test('true when Nest nests the payload under message', () {
      expect(
        isPermissionDenied(
          _err({
            'message': {'code': 'PERMISSION_DENIED', 'message': 'Not allowed'},
          }),
        ),
        isTrue,
      );
    });

    test('false for other 403s, non-Dio errors and empty bodies', () {
      expect(isPermissionDenied(_err({'code': 'ACCOUNT_UNDER_REVIEW'})), isFalse);
      expect(isPermissionDenied(_err(null)), isFalse);
      expect(isPermissionDenied(Exception('boom')), isFalse);
    });
  });

  group('friendlyApiError', () {
    test('uses the backend message', () {
      expect(
        friendlyApiError(_err({'message': 'Messaging is turned off.'})),
        'Messaging is turned off.',
      );
    });

    test('uses the first entry of a validation list', () {
      expect(
        friendlyApiError(
          _err({
            'message': ['reason too short', 'other'],
          }, status: 400),
        ),
        'reason too short',
      );
    });

    test('never leaks the raw Dio text', () {
      final msg = friendlyApiError(_err(null), fallback: 'Try again.');
      expect(msg, 'Try again.');
      expect(msg.contains('DioException'), isFalse);
    });

    test('strips the Exception prefix from plain exceptions', () {
      expect(friendlyApiError(Exception('Already reviewed')), 'Already reviewed');
    });

    test('connection problems get a plain message', () {
      final e = DioException(
        requestOptions: RequestOptions(path: '/x'),
        type: DioExceptionType.connectionError,
      );
      expect(friendlyApiError(e), 'Check your connection and try again.');
    });
  });
}
