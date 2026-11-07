import 'package:flutter_test/flutter_test.dart';
import 'package:uniscope_mobile/features/profile/profile_options.dart';

void main() {
  final base = degreesForStream('Medical');

  group('degreeChipOptions', () {
    test('slots approved custom degrees just before "Others"', () {
      final chips = degreeChipOptions(base, ['Optometry', 'B.Pharm']);
      expect(chips.last, 'Others');
      final i = chips.indexOf('Others');
      expect(chips.sublist(i - 2, i), ['Optometry', 'B.Pharm']);
      // Everything built in is still there, in order.
      expect(chips.where(base.contains).toList(), base);
    });

    test('drops approved names that are already a chip, in any casing', () {
      final chips = degreeChipOptions(base, ['mbbs', 'Optometry', 'optometry']);
      expect(chips.where((c) => c.toLowerCase() == 'mbbs').length, 1);
      expect(chips.where((c) => c.toLowerCase() == 'optometry').length, 1);
    });

    test('returns the base list untouched when nothing is approved', () {
      expect(identical(degreeChipOptions(base, const []), base), isTrue);
    });
  });

  group('approvedDegreeMatching', () {
    test('finds an approved name ignoring case and padding', () {
      expect(
        approvedDegreeMatching('  optometry ', base, ['Optometry']),
        'Optometry',
      );
    });

    test('never treats a built-in degree or blank text as custom', () {
      expect(approvedDegreeMatching('MBBS', base, ['MBBS']), isNull);
      expect(approvedDegreeMatching('   ', base, ['Optometry']), isNull);
      expect(approvedDegreeMatching('Others', base, ['Others']), isNull);
    });
  });

  group('isNewCustomDegree', () {
    bool check(String text, {String? stream = 'Medical', List<String>? approved}) =>
        isNewCustomDegree(
          stream: stream,
          text: text,
          base: base,
          approved: approved ?? const [],
        );

    test('accepts a plausible new degree', () {
      expect(check('Optometry'), isTrue);
      expect(check('  B.Pharm (Hons)  '), isTrue);
      expect(check('Diploma in X/Y & Z'), isTrue);
    });

    test('skips built-in and already-approved degrees', () {
      expect(check('mbbs'), isFalse);
      expect(check('optometry', approved: ['Optometry']), isFalse);
    });

    test('skips junk the server would reject', () {
      expect(check('a'), isFalse);
      expect(check('Others'), isFalse);
      expect(check('<script>'), isFalse);
      expect(check('x' * 51), isFalse);
    });

    test('skips the free-typed "Others" stream and a missing stream', () {
      expect(check('Optometry', stream: 'Others'), isFalse);
      expect(check('Optometry', stream: null), isFalse);
    });
  });
}
