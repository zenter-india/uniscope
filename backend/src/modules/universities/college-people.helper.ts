/** UG, PG, or anything that is neither (diplomas, "Others", nothing given). */
export type EducationLevel = 'UG' | 'PG' | 'OTHER';

// `UserProfile.qualification` holds the degree a user picked in onboarding (the
// per-stream lists in the app's profile_options): MBBS / BDS / B.Tech/B.E / the
// generic "UG" are undergraduate; PG / MD/MS / DNB / DM/MCh / MDS / M.Tech/M.E /
// Doctorate are postgraduate.
const UG = new Set(['ug', 'mbbs', 'bds', 'b.tech/b.e', 'b.tech', 'b.e']);
const PG = new Set([
  'pg',
  'md/ms',
  'dnb',
  'dm/mch',
  'mds',
  'm.tech/m.e',
  'm.tech',
  'doctorate',
]);

/** The exact `qualification` values the app stores for each level — for
 * filtering rows in the database (the sets above are for matching one value). */
export const UG_QUALIFICATIONS = ['UG', 'MBBS', 'BDS', 'B.Tech/B.E'];
export const PG_QUALIFICATIONS = [
  'PG',
  'MD/MS',
  'DNB',
  'DM/MCh',
  'MDS',
  'M.Tech/M.E',
  'Doctorate',
];

/**
 * The profile condition for "UG" or "PG" people, mirroring [educationLevel]:
 * UG = the undergraduate degrees; PG = the postgraduate ones plus a Medical
 * diploma.
 */
export function profileLevelWhere(level: 'UG' | 'PG') {
  return level === 'UG'
    ? { qualification: { in: UG_QUALIFICATIONS } }
    : {
        OR: [
          { qualification: { in: PG_QUALIFICATIONS } },
          { qualification: 'Diploma', stream: 'Medical' },
        ],
      };
}

/**
 * The level a person's degree sits at. A Medical "Diploma" is a postgraduate
 * diploma; in any other stream it is not clearly UG or PG, so it is OTHER.
 */
export function educationLevel(
  qualification: string | null | undefined,
  stream?: string | null,
): EducationLevel {
  const q = (qualification ?? '').trim().toLowerCase();
  if (UG.has(q)) return 'UG';
  if (PG.has(q)) return 'PG';
  if (q === 'diploma' && stream === 'Medical') return 'PG';
  return 'OTHER';
}
