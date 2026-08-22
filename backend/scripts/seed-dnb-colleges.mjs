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
 * Matching against *pre-existing* rows is name+state only (accepted
 * limitation — see the dedup-handling decision this was built against).
 * But rows *created during this run* are tracked separately, keyed by
 * name+state+district: several hospital chains repeat the same name in the
 * same state for genuinely different branches (e.g. "Ankura Hospital" has
 * 4 distinct Telangana locations; "Area Hospital" is a generic
 * government-hospital name reused across many towns) — collapsing those
 * onto name+state alone would silently overwrite one branch's
 * specializations with another's on every Program upsert, since the
 * second branch would "match" the row the first branch just created.
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
  const existingByNameState = new Map(
    existing.map((u) => [`${u.name.toLowerCase().trim()}|${u.state.toLowerCase().trim()}`, u]),
  );
  // Rows created during this run, keyed by name+state+address so distinct
  // branches sharing a name+state each get their own row.
  const createdThisRun = new Map();
  const taken = new Set(existing.map((u) => u.slug));

  const stats = { matched: 0, created: 0, programsCreated: 0, programsUpdated: 0 };

  for (const c of colleges) {
    const nameStateKey = `${c.name.toLowerCase().trim()}|${c.state.toLowerCase().trim()}`;
    const branchKey = `${nameStateKey}|${c.district.toLowerCase().trim()}`;
    let university = existingByNameState.get(nameStateKey) ?? createdThisRun.get(branchKey);

    if (university) {
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
