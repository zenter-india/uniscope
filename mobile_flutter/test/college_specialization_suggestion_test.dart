import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope_mobile/features/profile/profile_options.dart';

void main() {
  bool suggest({
    String? specialization = 'Community Medicine',
    String? universityId = 'c1',
    String? degreeKey = 'MD/MS',
    List<String> collegeList = const [],
  }) => shouldSuggestCollegeSpecialization(
    specialization: specialization,
    universityId: universityId,
    degreeKey: degreeKey,
    collegeList: collegeList,
  );

  group('shouldSuggestCollegeSpecialization', () {
    test('a brand-new college has no list, so whatever is chosen is suggested', () {
      expect(suggest(collegeList: const []), isTrue);
    });

    test('a specialization the college does not have yet is suggested', () {
      expect(suggest(collegeList: const ['Anatomy', 'Physiology']), isTrue);
    });

    test('one the college already lists is not (any casing or spacing)', () {
      expect(
        suggest(
          specialization: '  community   MEDICINE ',
          collegeList: const ['Community Medicine'],
        ),
        isFalse,
      );
    });

    test('needs a real college and a degree to attach it to', () {
      expect(suggest(universityId: null), isFalse);
      expect(suggest(universityId: ''), isFalse);
      expect(suggest(degreeKey: null), isFalse);
      expect(suggest(degreeKey: ''), isFalse);
    });

    test('skips blanks, the catch-all label and text the server would reject', () {
      expect(suggest(specialization: null), isFalse);
      expect(suggest(specialization: '  '), isFalse);
      expect(suggest(specialization: 'a'), isFalse);
      expect(suggest(specialization: 'Others'), isFalse);
      expect(suggest(specialization: '<script>'), isFalse);
      expect(suggest(specialization: 'x' * 101), isFalse);
    });

    test('accepts real specialization names with punctuation', () {
      expect(
        suggest(
          specialization:
              'MD - Social & Preventive Medicine / Community Medicine',
        ),
        isTrue,
      );
    });
  });
}
