/**
 * One-time data hygiene fix: 119 of ~10,500 University rows have a `state`
 * value that doesn't match any of the canonical names in mobile's
 * kIndianStates picklist (mobile_flutter/lib/features/profile/
 * profile_options.dart). Since Discover's State filter does an exact
 * client-side string match against that picklist (see
 * UniversityListScreen's `matchesState`), any college whose state string
 * doesn't match one of those 36 exact strings is invisible under every
 * specific state selection -- only "All" ever surfaces it. Found and
 * quantified live against the real Supabase DB while investigating a user
 * report of "state doesn't have all the states from India".
 *
 * Covers two contamination patterns, both clearly import artifacts (a bad
 * CSV/AISHE source column, not genuine alternate state names):
 *   1. Alternate/old spellings that don't match the current canonical name
 *      ("Orissa" -> "Odisha", "Pondicherry" -> "Puducherry",
 *      "Jammu & Kashmir" -> "Jammu and Kashmir", "Chhatisgarh" (missing a
 *      't') -> "Chhattisgarh", three different partial spellings of
 *      "Andaman and Nicobar Islands", and the three pre-2020-merger UT
 *      names -> "Dadra and Nagar Haveli and Daman and Diu").
 *   2. A stray numeric/text suffix baked onto an otherwise-correct name
 *      ("Andhra Pradesh-51800", "Karnataka-0", "Tamil Nadu Pri", etc.) --
 *      the base name before the suffix is always correct on its own.
 *
 * Deliberately does NOT touch the 38 rows where state is the literal
 * string "nan" (a pandas-NaN-serialized-as-string import artifact) -- none
 * of those rows have a city either, and their names (generic hospital
 * names like "Aravind Eye Hospital", which has branches across multiple
 * states) give no reliable way to infer the real state without guessing.
 * Left for a follow-up once better source data is available, or a
 * decision to make University.state nullable for genuinely-unknown rows.
 *
 * Safe to re-run: every UPDATE is scoped to an exact `state` string match,
 * so a row already fixed (or never dirty) is simply not touched again.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Exact old value -> exact canonical value (see kIndianStates).
const STATE_FIXES = {
  Orissa: 'Odisha',
  'Jammu & Kashmir': 'Jammu and Kashmir',
  Chhatisgarh: 'Chhattisgarh',
  Pondicherry: 'Puducherry',
  'Andaman & Nicobar': 'Andaman and Nicobar Islands',
  'Andaman Nicobar Islands': 'Andaman and Nicobar Islands',
  'Andaman and Nicobar': 'Andaman and Nicobar Islands',
  'Daman & Diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'Dadra and Nagar Haveli': 'Dadra and Nagar Haveli and Daman and Diu',
  'Dadara Nagar Haveli': 'Dadra and Nagar Haveli and Daman and Diu',
  'Karnataka-0': 'Karnataka',
  'Karnataka-1': 'Karnataka',
  'Nagaland-0': 'Nagaland',
  'Delhi-24': 'Delhi',
  'Bihar-80002': 'Bihar',
  'Tamil Nadu Pri': 'Tamil Nadu',
  'Tamil Nadu-33': 'Tamil Nadu',
  'Tamil Nadu-34': 'Tamil Nadu',
  'Tamil Nadu-53': 'Tamil Nadu',
  'Tamil Nadu-600': 'Tamil Nadu',
  'Tamil Nadu-63801': 'Tamil Nadu',
  'Andhra Pradesh-51800': 'Andhra Pradesh',
  'Andhra Pradesh-52008': 'Andhra Pradesh',
  'Telangana-4': 'Telangana',
  'Telangana-500': 'Telangana',
  'West Bengal-124': 'West Bengal',
  'West Bengal-73410': 'West Bengal',
  'Maharashtra Pri': 'Maharashtra',
  'Maharashtra-18': 'Maharashtra',
  'Maharashtra-40004': 'Maharashtra',
  'Maharashtra-50': 'Maharashtra',
  'Kerala-69100': 'Kerala',
};

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  let totalFixed = 0;
  for (const [from, to] of Object.entries(STATE_FIXES)) {
    const { count } = await prisma.university.updateMany({
      where: { state: from },
      data: { state: to },
    });
    if (count > 0) {
      console.log(`${String(count).padStart(3)}  "${from}" -> "${to}"`);
      totalFixed += count;
    }
  }

  console.log(`\nFixed ${totalFixed} rows.`);

  const remaining = await prisma.university.groupBy({
    by: ['state'],
    _count: true,
  });
  const clean = new Set([
    'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh',
    'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
    'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat',
    'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand',
    'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh',
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
    'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  ]);
  const stillDirty = remaining.filter((r) => !clean.has(r.state));
  console.log(
    `Still unmatched after this run (expected: only "nan", untouched by design):`,
  );
  for (const r of stillDirty) console.log(`  ${r._count}  "${r.state}"`);

  await prisma.$disconnect();
}

main();
