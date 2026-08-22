/**
 * Seed DNB colleges + their accredited specializations from the NBEMS
 * accreditation extract (see scripts/data/README.md for provenance).
 *
 * For each college in dnb-colleges.json: finds an existing University by
 * exact name+state match (case-insensitive, same rule as
 * UniversitiesService.findOrCreateByName) so a hospital already seeded as a
 * UG college gets a DNB Program attached rather than a duplicate row; a
 * college not found is created new. Either way, upserts a "DNB" Program
 * under that university with `specializations` set from the sheet.
 *
 * IMPORTANT — branch disambiguation: several hospital chains repeat the
 * same name in the same state for genuinely different branches (e.g.
 * "Ankura Hospital" has 4 distinct Telangana locations; "Area Hospital" is
 * a generic government-hospital name reused across many towns). A prior
 * version of this script matched *pre-existing* rows by name+state alone,
 * which meant every district-distinct JSON entry for such a name+state
 * group collided onto the SAME arbitrary pre-existing row, silently
 * overwriting its specializations on each upsert and leaving the other
 * real branch rows orphaned. Fixed by tracking which pre-existing
 * University ids have already been "claimed" by an earlier JSON entry in
 * this run: a pre-existing name+state match is only reused if it hasn't
 * been claimed yet (covers the common case of one college with one
 * district); once claimed, any further JSON entry with that name+state
 * (a different district = a different real branch) creates a fresh row
 * instead of reusing it, mirroring how `createdThisRun` already
 * disambiguates rows created within the same run by name+state+district.
 *
 * `type` has no reliable source in this data (NBEMS accreditation records
 * don't state govt/private) — every newly-created row defaults to PRIVATE,
 * same documented-approximate convention as
 * UniversitiesService.findOrCreateByName. isActive: true, unlike that
 * method's self-reported rows, because this data is an official NBEMS
 * accreditation extract, not a mentor's own free-text entry.
 *
 * Idempotent — keyed on (university match) + Program's
 * @@unique([universityId, name]), so a re-run updates specializations in
 * place instead of duplicating.
 *
 * Usage:
 *   node scripts/seed-dnb-colleges.mjs            # write
 *   node scripts/seed-dnb-colleges.mjs --dry-run   # report only
 */
import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'data');

const DRY_RUN = process.argv.includes('--dry-run');

/** Mirrors slugify() in universities.service.ts. */
function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function uniqueSlug(name, taken) {
  const base = slugify(name) || 'university';
  let slug = base;
  let n = 1;
  while (taken.has(slug)) {
    n += 1;
    slug = `${base}-${n}`;
  }
  taken.add(slug);
  return slug;
}

async function main() {
  const colleges = JSON.parse(await readFile(path.join(DATA, 'dnb-colleges.json'), 'utf8'));

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const existing = await prisma.university.findMany({
    select: { id: true, name: true, state: true, slug: true, levels: true },
  });
  // Read-only snapshot of what was already in the DB before this run —
  // never mutated, so a later same-name+state row in this run can't
  // "match" a branch this run itself just created for a different address.
  // Pre-existing rows may repeat a name+state key across genuinely
  // distinct branches, so this holds every candidate, not just one.
  const existingByNameState = new Map();
  for (const u of existing) {
    const key = `${u.name.toLowerCase().trim()}|${u.state.toLowerCase().trim()}`;
    const list = existingByNameState.get(key);
    if (list) list.push(u);
    else existingByNameState.set(key, [u]);
  }
  // Pre-existing University ids already reused by an earlier JSON entry in
  // this run — once claimed, a further entry with the same name+state (a
  // different district = a different real branch) must not reuse it too.
  const claimed = new Set();
  // Rows created during this run, keyed by name+state+address so distinct
  // branches sharing a name+state each get their own row.
  const createdThisRun = new Map();
  const taken = new Set(existing.map((u) => u.slug));

  const stats = { matched: 0, created: 0, programsCreated: 0, programsUpdated: 0 };

  for (const c of colleges) {
    const nameStateKey = `${c.name.toLowerCase().trim()}|${c.state.toLowerCase().trim()}`;
    const branchKey = `${nameStateKey}|${c.district.toLowerCase().trim()}`;
    const candidates = existingByNameState.get(nameStateKey) ?? [];
    const unclaimedCandidate = candidates.find((u) => !claimed.has(u.id));
    let university = createdThisRun.get(branchKey) ?? unclaimedCandidate;

    if (university) {
      if (!createdThisRun.has(branchKey)) {
        claimed.add(university.id);
        createdThisRun.set(branchKey, university);
      }
      stats.matched += 1;
      if (!university.levels.includes('PG')) {
        if (!DRY_RUN) {
          await prisma.university.update({
            where: { id: university.id },
            data: { levels: { push: 'PG' } },
          });
        }
      }
    } else {
      const slug = await uniqueSlug(c.name, taken);
      if (!DRY_RUN) {
        university = await prisma.university.create({
          data: {
            name: c.name,
            slug,
            type: 'PRIVATE',
            state: c.state,
            city: null,
            stream: 'Medical',
            levels: ['PG'],
            isActive: true,
          },
        });
      } else {
        university = { id: `dry-run:${slug}`, levels: ['PG'] };
      }
      createdThisRun.set(branchKey, university);
      stats.created += 1;
    }

    // District has no dedicated University column — carried on the Program
    // instead (unused Text field), same convention as the address+PIN this
    // replaced (kept for potential future use, not currently shown — the
    // College field label is just "name, state").
    if (!DRY_RUN) {
      const priorProgram = await prisma.program.findUnique({
        where: { universityId_name: { universityId: university.id, name: 'DNB' } },
      });
      await prisma.program.upsert({
        where: { universityId_name: { universityId: university.id, name: 'DNB' } },
        update: { description: c.district, specializations: c.specializations },
        create: {
          universityId: university.id,
          name: 'DNB',
          description: c.district,
          specializations: c.specializations,
        },
      });
      if (priorProgram) stats.programsUpdated += 1;
      else stats.programsCreated += 1;
    } else {
      stats.programsCreated += 1;
    }
  }

  console.log(
    `Universities: ${stats.matched} matched existing, ${stats.created} created.\n` +
      `DNB programs: ${stats.programsCreated} created, ${stats.programsUpdated} updated.` +
      (DRY_RUN ? '\n(dry run — nothing written)' : ''),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
