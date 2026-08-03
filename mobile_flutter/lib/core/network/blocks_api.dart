import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';

class BlockedUser {
  const BlockedUser({
    required this.id,
    required this.displayName,
    this.avatarUrl,
    required this.blockedAt,
  });

  final String id;
  final String displayName;
  final String? avatarUrl;
  final DateTime blockedAt;

  factory BlockedUser.fromJson(Map<String, dynamic> json) => BlockedUser(
        id: json['id'] as String,
        displayName: json['displayName'] as String,
        avatarUrl: json['avatarUrl'] as String?,
        blockedAt: DateTime.parse(json['blockedAt'] as String),
      );
}

class BlocksApi {
  BlocksApi(this._dio);

  final Dio _dio;

  Future<List<BlockedUser>> listBlocked() async {
    final res = await _dio.get<List<dynamic>>('/blocks');
    return res.data!.map((e) => BlockedUser.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> block(String userId) async {
    await _dio.post<void>('/blocks/$userId');
  }

  Future<void> unblock(String userId) async {
    await _dio.delete<void>('/blocks/$userId');
  }
}

final blocksApiProvider = Provider<BlocksApi>(
  (ref) => BlocksApi(ref.watch(dioProvider)),
);

/// The current user's blocked-user id set — mirrors SavedMentorIdsNotifier's
/// shape so mentor cards/detail screens can check block state the same way
/// they check saved state.
class BlockedUserIdsNotifier extends AsyncNotifier<Set<String>> {
  @override
  Future<Set<String>> build() async {
    final blocked = await ref.read(blocksApiProvider).listBlocked();
    return blocked.map((b) => b.id).toSet();
  }

  Future<void> block(String userId) async {
    final current = state.value ?? <String>{};
    state = AsyncData({...current, userId});
    try {
      await ref.read(blocksApiProvider).block(userId);
    } catch (_) {
      state = AsyncData({...current}); // revert on failure
    }
  }

  Future<void> unblock(String userId) async {
    final current = state.value ?? <String>{};
    state = AsyncData({...current}..remove(userId));
    try {
      await ref.read(blocksApiProvider).unblock(userId);
    } catch (_) {
      state = AsyncData({...current}); // revert on failure
    }
  }
}

final blockedUserIdsProvider =
    AsyncNotifierProvider<BlockedUserIdsNotifier, Set<String>>(
  BlockedUserIdsNotifier.new,
);

final blockedUsersListProvider = FutureProvider.autoDispose<List<BlockedUser>>(
  (ref) => ref.watch(blocksApiProvider).listBlocked(),
);
