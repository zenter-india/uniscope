/// Shared picklists for profile-related forms (EditProfileScreen, the
/// aspirant onboarding wizard, and any future mentor onboarding wizard) —
/// kept in one place so the two flows never drift apart.
library;

const kGenders = ['Male', 'Female', 'Other', 'Prefer not to say'];

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
  'Class 11',
  'Class 12',
  'Dropper / Repeater',
  'Undergraduate',
  'Graduate',
  'Other',
];

const kCurrentStatuses = [
  'Currently Studying',
  'Dropper / Repeater',
  'Working Professional',
  'Other',
];

const kStreams = ['PCB', 'PCM', 'PCMB', 'Other'];

const kCoursesInterested = [
  'MBBS',
  'BDS',
  'BAMS',
  'BHMS',
  'BPT',
  'Nursing',
  'Other',
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
