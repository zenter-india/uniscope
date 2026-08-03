/// Shared picklists for profile-related forms (EditProfileScreen, the
/// aspirant onboarding wizard, and any future mentor onboarding wizard) —
/// kept in one place so the two flows never drift apart.
library;

const kGenders = ['Male', 'Female', 'Other'];

// Mentors are current medical students or alumni — never practicing doctors
// — so these are guidance topics an aspirant would ask about, not clinical
// specialties.
const kGuidanceAreas = [
  'NEET Preparation',
  'MBBS Academics',
  'Campus & Hostel Life',
  'College Selection & Counseling',
  'PG / NEET-PG Prep',
  'Research & Publications',
  'Rural / Government Posting',
  'Extracurriculars & MBBS Life',
  'Other',
];

const kLanguageOptions = [
  'English',
  'Hindi',
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Bengali',
  'Marathi',
  'Gujarati',
  'Punjabi',
];

const kQualifications = [
  'Higher Secondary (11th/12th)',
  'Undergraduate',
  'Postgraduate',
  'Doctorate',
];

const kIndianStates = [
  'Andhra Pradesh', 'Bihar', 'Delhi', 'Gujarat', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Punjab', 'Rajasthan', 'Tamil Nadu',
  'Telangana', 'Uttar Pradesh', 'West Bengal', 'Other',
];

const kGoalOptions = [
  'NEET',
  'AIIMS',
  'JIPMER',
  'Government College',
  'Private College',
  'Study Abroad',
];

const kMentorshipTimings = [
  'Weekday mornings',
  'Weekday evenings',
  'Weekends',
  'Flexible / Anytime',
];

const kWeekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

// UserProfile.stream — a mentor's college field of study, or an aspirant's
// field of interest ("used for mentor matching"). Same list either way since
// Uniscope spans every academic field now, not just medical; "Others" pairs
// with a free-text field in the UI.
const kStreamOptions = [
  'Medical',
  'Dental',
  'Engineering',
  'Arts & Humanities',
  'Commerce & Business',
  'Law',
  'Design',
  'Others',
];

const kDegrees = ['UG', 'PG', 'Doctorate'];

const kCurrentStatuses = ['Currently Studying', 'Graduated'];

const kYearsOfStudy = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year+'];
