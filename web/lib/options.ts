/**
 * Picklists for the enrollment forms.
 *
 * These deliberately mirror `mobile_flutter/lib/features/onboarding/
 * profile_options.dart` value-for-value. A lead is meant to convert into a
 * real UserProfile later by copying columns across, so if the website offers
 * "Commerce and Business" while the app stores "Commerce & Business", every
 * converted account lands with a value the app's own dropdowns can't render.
 * Keep the two files in sync; when one changes, change both.
 */

export const GENDERS = ["Male", "Female", "Other"] as const;

export const LANGUAGES = [
  "English",
  "Hindi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Bengali",
  "Marathi",
  "Gujarati",
  "Punjabi",
] as const;

export const QUALIFICATIONS = [
  "Higher Secondary (11th/12th)",
  "Undergraduate",
  "Postgraduate",
  "Doctorate",
] as const;

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Bihar",
  "Delhi",
  "Gujarat",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "West Bengal",
  "Other",
] as const;

export const GOALS = [
  "NEET",
  "AIIMS",
  "JIPMER",
  "Government College",
  "Private College",
  "Study Abroad",
] as const;

export const MENTORSHIP_TIMINGS = ["Weekdays", "Weekend", "Anytime"] as const;

/** Mentor's "days you're generally free" — collapsed to two selectable
 * windows rather than picking individual weekdays; both may be selected. */
export const AVAILABILITY_WINDOWS = ["Weekdays (Mon-Fri)", "Weekends"] as const;

/** UserProfile.stream — a mentor's field of study, or an aspirant's field of
 * interest. Uniscope covers every academic field, not just medical. */
export const STREAMS = [
  "Medical",
  "Dental",
  "Engineering",
  "Arts & Humanities",
  "Commerce & Business",
  "Law",
  "Design",
  "Others",
] as const;

export const DEGREES = ["UG", "PG", "Doctorate"] as const;

export const CURRENT_STATUSES = ["Currently Studying", "Graduated"] as const;

export const YEARS_OF_STUDY = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year+",
] as const;

/** Matches the backend's DocumentType enum. */
export const DOCUMENT_TYPES = [
  { value: "STUDENT_ID", label: "College / Student ID card" },
  { value: "STUDENT_PORTAL_SCREENSHOT", label: "Student portal screenshot" },
  { value: "DEGREE_CERTIFICATE", label: "Degree certificate" },
  { value: "NMC_REGISTRATION", label: "NMC registration" },
] as const;
