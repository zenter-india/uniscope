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
  "Others",
] as const;

export const QUALIFICATIONS = [
  "Higher Secondary (12th)",
  "Undergraduate",
  "Postgraduate",
  "Doctorate",
  "Others",
] as const;

/** All 28 states + 8 union territories, alphabetical (with "Other" kept last
 * as the natural fall-through). "Other" reveals a free-text field on both
 * forms rather than losing the answer for anyone outside this list. */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Other",
] as const;

/** Major Indian cities, alphabetical, covering every state/UT capital plus
 * other well-known hubs. Same "Other" fall-through pattern as
 * `INDIAN_STATES` — a city not on this list still isn't lost, since picking
 * "Other" reveals a free-text field instead of forcing a nearest-match. */
export const CITIES = [
  "Agra",
  "Ahmedabad",
  "Aligarh",
  "Amritsar",
  "Aurangabad",
  "Bengaluru",
  "Bhopal",
  "Bhubaneswar",
  "Chandigarh",
  "Chennai",
  "Coimbatore",
  "Dehradun",
  "Delhi",
  "Dhanbad",
  "Faridabad",
  "Ghaziabad",
  "Gorakhpur",
  "Guwahati",
  "Gwalior",
  "Hyderabad",
  "Indore",
  "Jabalpur",
  "Jaipur",
  "Jalandhar",
  "Jammu",
  "Jamshedpur",
  "Jodhpur",
  "Kanpur",
  "Kochi",
  "Kolkata",
  "Kota",
  "Lucknow",
  "Ludhiana",
  "Madurai",
  "Mangaluru",
  "Meerut",
  "Mumbai",
  "Mysuru",
  "Nagpur",
  "Nashik",
  "Navi Mumbai",
  "Noida",
  "Panaji",
  "Patna",
  "Puducherry",
  "Pune",
  "Raipur",
  "Rajkot",
  "Ranchi",
  "Salem",
  "Shimla",
  "Siliguri",
  "Srinagar",
  "Surat",
  "Thane",
  "Thiruvananthapuram",
  "Tiruchirappalli",
  "Udaipur",
  "Vadodara",
  "Varanasi",
  "Vijayawada",
  "Visakhapatnam",
  "Warangal",
  "Other",
] as const;

/** Time-of-day slots — shared shape for both the aspirant's "when do you
 * want to talk" preference and the mentor's "when am I generally free"
 * availability, so the two sides of a booking speak the same vocabulary.
 * Deliberately time-of-day, not day-of-week — a weekday/weekend picker just
 * has everyone pick weekend, which tells the matching logic nothing. */
export const TIME_SLOTS = [
  "Morning (6 AM - 12 PM)",
  "Afternoon (12 PM - 4 PM)",
  "Evening (4 PM - 8 PM)",
  "Night (8 PM - 11 PM)",
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

/** Some medical/dental degrees run 6 years, so this goes to 6th rather than
 * capping at "5th Year+" the way a typical 4-year UG picklist would. */
export const YEARS_OF_STUDY = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
  "6th Year",
] as const;

/** Matches the backend's DocumentType enum (`CreateMentorLeadDto.documentType`)
 * — only the display labels below are free to change, the `value`s must stay
 * in sync with the Prisma enum. Labels were genericized (was "NMC
 * registration", medical-only) since mentors now come from every stream. */
export const DOCUMENT_TYPES = [
  { value: "STUDENT_ID", label: "College / Student ID card" },
  { value: "STUDENT_PORTAL_SCREENSHOT", label: "Admission order" },
  { value: "DEGREE_CERTIFICATE", label: "Degree certificate" },
  { value: "NMC_REGISTRATION", label: "Registration certificate" },
] as const;
