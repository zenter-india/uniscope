import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

/// Profile-creation picklists that grow from what people type under
/// "Others" — today that is the degree / course.
class ProfileOptionsApi {
  ProfileOptionsApi(this._dio);

  final Dio _dio;

  /// Degrees an admin has approved for [stream] (typed by earlier users under
  /// "Others"), A–Z. Shown as ordinary options before "Others".
  Future<List<String>> approvedDegrees(String stream) async {
    final res = await _dio.get<List<dynamic>>(
      '/profile-options/degrees',
      queryParameters: {'stream': stream},
    );
    return [for (final name in res.data ?? const []) name as String];
  }

  /// Queues a degree the user typed under "Others" for admin approval. The
  /// same degree typed again only counts one more request on the server.
  Future<void> submitDegree({
    required String stream,
    required String name,
  }) async {
    await _dio.post<void>(
      '/profile-options/degrees',
      data: {'stream': stream, 'name': name.trim()},
    );
  }
}

final profileOptionsApiProvider = Provider<ProfileOptionsApi>(
  (ref) => ProfileOptionsApi(ref.watch(dioProvider)),
);

/// Approved custom degrees for a stream. A failure (offline, older backend)
/// just means no extra chips — the wizards read it with `asData?.value`.
final approvedDegreesProvider = FutureProvider.autoDispose
    .family<List<String>, String>(
      (ref, stream) =>
          ref.watch(profileOptionsApiProvider).approvedDegrees(stream),
    );
