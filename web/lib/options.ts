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
  "Higher Secondary (12th)",
  "Undergraduate",
  "Postgraduate",
  "Doctorate",
  "Others",
] as const;

/** All 28 states + 8 union territories. "Other" reveals a free-text field on
 * both forms rather than losing the answer for anyone outside this list. */
export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
  "Other",
] as const;

/** Time-of-day slots — shared shape for both the aspirant's "when do you
 * want to talk" preference and the mentor's "when am I generally free"
 * availability, so the two sides of a booking speak the same vocabulary. */
export const TIME_SLOTS = [
  "Morning (6 AM - 12 PM)",
  "Afternoon (12 PM - 5 PM)",
  "Evening (5 PM - 9 PM)",
  "Night (9 PM onwards)",
] as const;

export const MENTORSHIP_TIMINGS = TIME_SLOTS;

/** Mentor's "days you're generally free". */
export const AVAILABILITY_WINDOWS = TIME_SLOTS;

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

export const DEGREES = ["UG", "PG", "MD/MS", "DNB", "Diploma", "Doctorate", "DM/MCh", "Others"] as const;

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
