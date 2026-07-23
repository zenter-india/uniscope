import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';
import 'universities_api.dart';

class CollegeWishlistApi {
  CollegeWishlistApi(this._dio);

  final Dio _dio;

  Future<List<University>> listSaved() async {
    final res = await _dio.get<List<dynamic>>('/college-wishlist');
    return res.data!.map((e) => University.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<String>> listSavedIds() async {
    final res = await _dio.get<List<dynamic>>('/college-wishlist/ids');
    return res.data!.map((e) => e as String).toList();
  }

  Future<void> save(String universityId) async {
    await _dio.post<void>('/college-wishlist/$universityId');
  }

  Future<void> unsave(String universityId) async {
    await _dio.delete<void>('/college-wishlist/$universityId');
  }
}

final collegeWishlistApiProvider = Provider<CollegeWishlistApi>(
  (ref) => CollegeWishlistApi(ref.watch(dioProvider)),
);

/// Mirrors SavedMentorIdsNotifier — a single cached id set mutated
/// optimistically so every college card (list, detail, saved screen) stays
/// in sync without each doing its own round-trip.
class SavedCollegeIdsNotifier extends AsyncNotifier<Set<String>> {
  @override
  Future<Set<String>> build() async {
    final ids = await ref.read(collegeWishlistApiProvider).listSavedIds();
    return ids.toSet();
  }

  Future<void> toggle(String universityId) async {
    final current = state.value ?? <String>{};
    final api = ref.read(collegeWishlistApiProvider);

    if (current.contains(universityId)) {
      state = AsyncData({...current}..remove(universityId));
      try {
        await api.unsave(universityId);
      } catch (_) {
        state = AsyncData({...current});
      }
    } else {
      state = AsyncData({...current, universityId});
      try {
        await api.save(universityId);
      } catch (_) {
        state = AsyncData({...current});
      }
    }
  }
}

final savedCollegeIdsProvider =
    AsyncNotifierProvider<SavedCollegeIdsNotifier, Set<String>>(
  SavedCollegeIdsNotifier.new,
);

final savedCollegesListProvider = FutureProvider.autoDispose<List<University>>(
  (ref) => ref.watch(collegeWishlistApiProvider).listSaved(),
);
