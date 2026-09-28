import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope_mobile/core/network/university_reviews_api.dart';
import 'package:uniscope_mobile/features/universities/university_review_screen.dart';

const _review = UniversityReview(
  id: 'r1',
  universityId: 'u1',
  overallRating: 3,
  academicExposure: 3,
  campusCulture: 3,
  workload: 3,
  futureValue: 3,
  restroomFacilities: 'ADEQUATE',
  raggingCulture: 'MINOR_ISSUES',
  facultyApproachability: 'SCHEDULED_HOURS',
  stipendStatus: 'NONE',
  hostelAvailability: 'AVERAGE',
  hostelSafety: 'DECENT',
  // The two long answers from the device video.
  wouldRecommend: 'DEPENDS',
  valueForMoney: 'BORDERLINE',
  helpfulCount: 0,
  createdAt: '2026-09-28T00:00:00.000Z',
  authorRole: 'MENTOR',
);

/// The read-only "Your Review" page: each row is a label on the left and the
/// reviewer's answer on the right. A long answer used to take the whole row
/// and squeeze the label to a sliver, so "Would You Recommend?" wrapped one
/// letter per line (real device video). The label must always keep a usable
/// share of the row, whatever the answer's length.
void main() {
  testWidgets('long answers do not squeeze the row label to a sliver', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 1800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          myUniversityReviewProvider.overrideWith((ref, id) async => _review),
        ],
        child: const MaterialApp(
          home: MyUniversityReviewScreen(
            universityId: 'u1',
            universityName: 'Test College',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Row inner width is ~360 minus page + card padding; the label must get
    // well over a sliver of it (the buggy layout gave it ~0-20px).
    for (final label in ['Would You Recommend?', 'Value for Money']) {
      final width = tester.getSize(find.text(label)).width;
      expect(
        width,
        greaterThan(90),
        reason: '"$label" was squeezed to ${width}px by its long answer',
      );
    }
  });
}
