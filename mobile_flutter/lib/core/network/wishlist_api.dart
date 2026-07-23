import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';
import 'mentors_api.dart';

class WishlistApi {
  WishlistApi(this._dio);

  final Dio _dio;

  Future<List<Mentor>> listSaved() async {
    final res = await _dio.get<List<dynamic>>('/wishlist');
    return res.data!.map((e) => Mentor.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<String>> listSavedIds() async {
    final res = await _dio.get<List<dynamic>>('/wishlist/ids');
    return res.data!.map((e) => e as String).toList();
  }

  Future<void> save(String mentorId) async {
    await _dio.post<void>('/wishlist/$mentorId');
  }

  Future<void> unsave(String mentorId) async {
    await _dio.delete<void>('/wishlist/$mentorId');
  }
}

final wishlistApiProvider = Provider<WishlistApi>(
  (ref) => WishlistApi(ref.watch(dioProvider)),
);

/// The aspirant's saved-mentor id set — fetched once and mutated optimistically
/// by the save/unsave toggle so every mentor card (list, detail, saved
/// screen) stays in sync without each doing its own round-trip.
class SavedMentorIdsNotifier extends AsyncNotifier<Set<String>> {
  @override
  Future<Set<String>> build() async {
    final ids = await ref.read(wishlistApiProvider).listSavedIds();
    return ids.toSet();
  }

  Future<void> toggle(String mentorId) async {
    final current = state.value ?? <String>{};
    final api = ref.read(wishlistApiProvider);

    if (current.contains(mentorId)) {
      state = AsyncData({...current}..remove(mentorId));
      try {
        await api.unsave(mentorId);
      } catch (_) {
        state = AsyncData({...current}); // revert on failure
      }
    } else {
      state = AsyncData({...current, mentorId});
      try {
        await api.save(mentorId);
      } catch (_) {
        state = AsyncData({...current}); // revert on failure
      }
    }
  }
}

final savedMentorIdsProvider =
    AsyncNotifierProvider<SavedMentorIdsNotifier, Set<String>>(
  SavedMentorIdsNotifier.new,
);

final savedMentorsListProvider = FutureProvider.autoDispose<List<Mentor>>(
  (ref) => ref.watch(wishlistApiProvider).listSaved(),
);
