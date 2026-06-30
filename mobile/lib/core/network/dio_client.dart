import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../env.dart';
import 'auth_interceptor.dart';

BaseOptions _baseOptions() => BaseOptions(
      baseUrl: Env.apiBaseUrl,
      connectTimeout: const Duration(milliseconds: Env.httpTimeoutMs),
      receiveTimeout: const Duration(milliseconds: Env.httpTimeoutMs),
      headers: {'Content-Type': 'application/json'},
    );

/// Bare Dio with NO auth interceptor — used only to call `/auth/token/refresh`,
/// preventing interceptor recursion (the RN code used a bare `axios.post`).
final refreshDioProvider = Provider<Dio>((ref) => Dio(_baseOptions()));

/// Main Dio used by every feature API. Carries the [AuthInterceptor]
/// (Bearer attach + single-flight 401 refresh + replay).
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(_baseOptions());
  final refreshDio = ref.read(refreshDioProvider);
  dio.interceptors.add(
    AuthInterceptor(ref: ref, mainDio: dio, refreshDio: refreshDio),
  );
  return dio;
});
