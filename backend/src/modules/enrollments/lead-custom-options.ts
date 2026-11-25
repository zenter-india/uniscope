import { CUSTOM_DEGREE_STREAMS } from '../profile-options/custom-degree-streams.js';
import { DEGREE_NAME_PATTERN } from '../profile-options/dto/submit-custom-degree.dto.js';

/**
 * What the public website form sends when someone types their own course or
 * specialization. The form submits the typed text in the same field as a
 * picked one (`degree` / `qualification` / `specialization`), so the backend
 * has to recognise "this is not one of the built-in choices" itself, then queue
 * it for admin approval the same way the mobile app does.
 */

/** The built-in degree choices per stream — mirrors `DEGREES`,
 * `DEGREES_BY_STREAM` and `DEFAULT_NON_MEDICAL_DEGREES` in `web/lib/options.ts`
 * (and mobile `degreesForStream`). Kept in sync by hand, like the other
 * web-mirroring constants in this module: a value missing here is queued for an
 * admin as if the person had typed it, which is harmless but noisy. */
const STANDARD_DEGREES_BY_STREAM: Record<string, readonly string[]> = {
  Medical: [
    'MBBS',
    'PG',
    'MD/MS',
    'DNB',
    'Diploma',
    'Doctorate',
    'DM/MCh',
    'Others',
  ],
  Dental: ['BDS', 'MDS', 'Doctorate', 'Others'],
  Engineering: ['B.Tech/B.E', 'M.Tech/M.E', 'Diploma', 'Doctorate', 'Others'],
};
const DEFAULT_DEGREES = ['UG', 'PG', 'Doctorate', 'Others'] as const;

/** Offered first on the aspirant form's qualification list, in every stream. */
const ALWAYS_STANDARD = ['Higher Secondary (12th)'] as const;

/** Collapses whitespace like the approval services do, so "B.  Pharm" and
 * "b.pharm" are one entry. */
export function tidyTypedName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** The typed course, ready to queue — or null when it is a built-in choice,
 * the catch-all "Others", an empty/odd value, or the stream has no shared
 * course list (a free-typed "Others" stream). */
export function customDegreeToQueue(
  stream: string | undefined,
  rawDegree: string | undefined,
): { stream: string; name: string } | null {
  if (!stream || !CUSTOM_DEGREE_STREAMS.includes(stream) || !rawDegree) {
    return null;
  }
  const name = tidyTypedName(rawDegree);
  if (name.length < 2 || name.length > 50) return null;
  if (!DEGREE_NAME_PATTERN.test(name)) return null;
  const key = name.toLowerCase();
  if (key === 'other' || key === 'others') return null;
  const builtIn = [
    ...(STANDARD_DEGREES_BY_STREAM[stream] ?? DEFAULT_DEGREES),
    ...ALWAYS_STANDARD,
  ];
  if (builtIn.some((d) => d.toLowerCase() === key)) return null;
  return { stream, name };
}

/** A typed specialization worth sending to an admin for the mentor's college:
 * a plausible name. Whether it is already on the college's list is checked by
 * the approval service itself (it answers `ALREADY_LISTED`). */
export function specializationToQueue(
  rawSpecialization: string | undefined,
): string | null {
  if (!rawSpecialization) return null;
  const name = tidyTypedName(rawSpecialization);
  if (name.length < 2 || name.length > 100) return null;
  if (!DEGREE_NAME_PATTERN.test(name)) return null;
  const key = name.toLowerCase();
  if (key === 'other' || key === 'others') return null;
  return name;
}
