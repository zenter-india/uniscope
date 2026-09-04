/// Content spec for the client-confirmed 12-question university review.
/// Question wording, choice labels and sub-copy are verbatim from the
/// approved design; the choice *codes* mirror
/// backend/src/modules/university-reviews/dto/review-choices.ts exactly —
/// keep the two in sync (the backend validates every code).
///
/// The visual treatment is Uniscope's own light-green system (AppColors /
/// AppFont), not the dark indigo mockup — only structure, wording and
/// interaction are taken from the mockup.
library;

import 'package:flutter/painting.dart' show Color;

/// Q1–Q4: 1–5 sliders. `captions[i]` is the label shown for value i+1.
class ReviewSliderSpec {
  const ReviewSliderSpec({
    required this.field,
    required this.title,
    required this.subtitle,
    required this.captions,
  });

  /// The `CreateUniversityReviewDto` / payload key this answer is sent as.
  final String field;
  final String title;
  final String subtitle;
  final List<String> captions; // length 5

  String captionFor(int value) => captions[value.clamp(1, 5) - 1];
}

const kReviewSliders = <ReviewSliderSpec>[
  ReviewSliderSpec(
    field: 'clinicalExposureRating', // Q1
    title: 'Academic Exposure',
    subtitle:
        'Quality of teaching, curriculum depth and practical / clinical exposure',
    captions: ['Poor', 'Below Average', 'Average', 'Good', 'Excellent'],
  ),
  ReviewSliderSpec(
    field: 'campusLifeRating', // Q2
    title: 'Campus Culture & Environment',
    subtitle:
        'How healthy, supportive and positive is the college environment?',
    captions: ['Toxic', 'Strained', 'Neutral', 'Friendly', 'Amazing'],
  ),
  ReviewSliderSpec(
    field: 'workloadRating', // Q3
    title: 'Workload & Stress Level',
    subtitle:
        'How manageable is the daily schedule, duty hours and workload?',
    captions: [
      'Overwhelming',
      'Difficult',
      'Moderate',
      'Manageable',
      'Balanced',
    ],
  ),
  ReviewSliderSpec(
    field: 'placementsRating', // Q4
    title: 'Future Value & Career Outcomes',
    subtitle: 'How well does this college prepare you for your career ahead?',
    captions: ['Poor', 'Below Average', 'Average', 'Good', 'Excellent'],
  ),
];

/// One selectable option in a Q5–Q11 choice question.
class ReviewChoiceOption {
  const ReviewChoiceOption(this.code, this.emoji, this.label);
  final String code;
  final String emoji;
  final String label;
}

/// Q5–Q11: single-choice questions.
class ReviewChoiceSpec {
  const ReviewChoiceSpec({
    required this.field,
    required this.title,
    required this.subtitle,
    required this.options,
    required this.positiveCodes,
    required this.positivePhrase,
  });

  final String field;
  final String title;
  final String subtitle;
  final List<ReviewChoiceOption> options;

  /// Codes that count toward the breakdown headline (`N% <phrase>`).
  final List<String> positiveCodes;

  /// Verb phrase completing "N% of reviewers ...", e.g.
  /// "find faculty approachable". Kept per-question (not derived) so the
  /// headline reads like the approved design, not a robotic label dump.
  final String positivePhrase;

  String? labelForCode(String? code) {
    if (code == null) return null;
    for (final o in options) {
      if (o.code == code) return o.label;
    }
    return null;
  }

  int indexOfCode(String code) => options.indexWhere((o) => o.code == code);
}

/// Severity tint for a choice option, green (best, index 0) → red (worst).
/// "NA" ("not applicable — no hostel") is a neutral answer, not a bad one,
/// so it renders grey.
Color reviewChoiceSeverityColor(String code, int index, int optionCount) {
  if (code == 'NA') return const Color(0xFF97A59E); // AppColors.textMuted
  if (optionCount <= 1) return const Color(0xFF12A150); // AppColors.success
  final t = index / (optionCount - 1);
  if (t <= 0.0) return const Color(0xFF12A150); // green  — success
  if (t < 0.34) return const Color(0xFF8BC34A); // lime
  if (t < 0.67) return const Color(0xFFF5A524); // amber  — warning
  if (t < 0.9) return const Color(0xFFEF6C4D); // orange
  return const Color(0xFFE5484D); // red — error
}

const kReviewChoices = <ReviewChoiceSpec>[
  ReviewChoiceSpec(
    field: 'raggingCulture', // Q5
    title: 'Ragging & Toxicity',
    subtitle: 'How would you describe the senior-junior relationship?',
    positiveCodes: ['HEALTHY', 'MINOR_ISSUES'],
    positivePhrase: 'say the senior–junior relationship is healthy or fine',
    options: [
      ReviewChoiceOption('HEALTHY', '😊', 'Very healthy and supportive'),
      ReviewChoiceOption('MINOR_ISSUES', '🙂', 'Generally fine, minor issues'),
      ReviewChoiceOption('DEPT_DEPENDENT', '😐', 'Depends on the department'),
      ReviewChoiceOption('TOXIC_AREAS', '😟', 'Toxic in some areas'),
      ReviewChoiceOption('SERIOUS', '🚨', 'Serious ragging or toxic culture'),
    ],
  ),
  ReviewChoiceSpec(
    field: 'facultyApproachability', // Q6
    title: 'Faculty Approachability',
    subtitle: 'How accessible and approachable are the faculty members?',
    positiveCodes: ['OPEN_DOOR', 'SCHEDULED_HOURS'],
    positivePhrase: 'find faculty approachable',
    options: [
      ReviewChoiceOption('OPEN_DOOR', '🟢', 'Very approachable — open door policy'),
      ReviewChoiceOption(
        'SCHEDULED_HOURS',
        '🟡',
        'Approachable during scheduled hours',
      ),
      ReviewChoiceOption('HIT_OR_MISS', '🟠', 'Hit or miss — depends on the faculty'),
      ReviewChoiceOption(
        'HARD_TO_REACH',
        '🔴',
        'Difficult to reach — not student-friendly',
      ),
    ],
  ),
  ReviewChoiceSpec(
    field: 'stipendStatus', // Q7
    title: 'Stipend',
    subtitle: 'Is stipend paid to students / residents at this college?',
    positiveCodes: ['ON_TIME'],
    positivePhrase: 'get paid on time every month',
    options: [
      ReviewChoiceOption('ON_TIME', '💚', 'Yes — paid on time every month'),
      ReviewChoiceOption('DELAYED', '🟡', 'Yes — but delayed frequently'),
      ReviewChoiceOption('INSUFFICIENT', '🟠', 'Yes — but amount is insufficient'),
      ReviewChoiceOption('IRREGULAR', '🔴', 'Rarely or irregularly paid'),
      ReviewChoiceOption('NONE', '⚫', 'Not applicable / No stipend provided'),
    ],
  ),
  ReviewChoiceSpec(
    field: 'hostelAvailability', // Q8
    title: 'Hostel & Residential Facility',
    subtitle:
        'Is hostel or residential accommodation available at this college?',
    positiveCodes: ['GOOD', 'AVERAGE'],
    positivePhrase: 'have hostel access in good or average condition',
    options: [
      ReviewChoiceOption('GOOD', '🏠', 'Yes — available and well maintained'),
      ReviewChoiceOption('AVERAGE', '🙂', 'Yes — available but average condition'),
      ReviewChoiceOption('POOR', '😟', 'Yes — available but poor condition'),
      ReviewChoiceOption('NONE', '❌', 'Not available at all'),
    ],
  ),
  ReviewChoiceSpec(
    field: 'hostelSafety', // Q9
    title: 'Hostel Safety & Comfort',
    subtitle: 'How safe, clean and comfortable is the hostel environment?',
    positiveCodes: ['VERY_SAFE', 'DECENT'],
    positivePhrase: 'feel safe and comfortable in the hostel',
    options: [
      ReviewChoiceOption('VERY_SAFE', '✅', 'Very safe, clean and comfortable'),
      ReviewChoiceOption('DECENT', '🟡', 'Decent — manageable day to day'),
      ReviewChoiceOption('CONCERNS', '🟠', 'Some safety or hygiene concerns'),
      ReviewChoiceOption('POOR', '🔴', 'Poor — not recommended'),
      ReviewChoiceOption('NA', '⚫', 'Not applicable — no hostel'),
    ],
  ),
  ReviewChoiceSpec(
    field: 'wouldRecommend', // Q10
    title: 'Would You Recommend?',
    subtitle:
        'Would you recommend this college to a student with similar goals?',
    positiveCodes: ['ABSOLUTELY', 'RIGHT_PERSON'],
    positivePhrase: 'would recommend this college',
    options: [
      ReviewChoiceOption('ABSOLUTELY', '✅', 'Absolutely — without hesitation'),
      ReviewChoiceOption('RIGHT_PERSON', '🤔', 'Yes — but only for the right person'),
      ReviewChoiceOption('DEPENDS', '⚖️', "Depends on what they're looking for"),
      ReviewChoiceOption('PROBABLY_NOT', '❌', 'Honestly, probably not'),
    ],
  ),
  ReviewChoiceSpec(
    field: 'valueForMoney', // Q11
    title: 'Value for Money',
    subtitle:
        'Considering fees, facilities and outcomes — is this college worth it?',
    positiveCodes: ['WORTH_IT', 'COULD_BE_BETTER'],
    positivePhrase: "say it's worth the fees",
    options: [
      ReviewChoiceOption('WORTH_IT', '💚', '100% worth every rupee'),
      ReviewChoiceOption('COULD_BE_BETTER', '🟡', 'Worth it — but could be better'),
      ReviewChoiceOption(
        'BORDERLINE',
        '🟠',
        'Borderline — think carefully before joining',
      ),
      ReviewChoiceOption('NOT_WORTH', '🔴', 'Not worth the fees at all'),
    ],
  ),
];

/// Q12 star labels (1-indexed via `[value - 1]`).
const kOverallStarLabels = <String>[
  'Poor',
  'Below Average',
  'Average',
  'Good',
  'Outstanding',
];

/// Max length of the optional "In your own words" summary.
const kReviewSummaryMaxChars = 300;
