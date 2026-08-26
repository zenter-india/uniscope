/**
 * Seed BDS (Dental UG) colleges (see scripts/data/README.md for
 * provenance). Unlike every other seed script here, this source has no
 * specialization data at all — BDS is the base dental degree, not a
 * postgrad specialty program — so this only creates/updates University
 * rows, no Program rows. The mentor form's College field for
 * Stream=Dental (CollegeSearch with `stream="Dental"`) reads directly
 * from GET /universities, not the curated/Program-based endpoint.
 *
 * Matching/creation rules mirror seed-dnb-colleges.mjs: finds an existing
 * University by name+state match (case-insensitive), with pre-existing
 * rows tracked via a "claimed" set (see that file's header comment for
 * why) so a repeated name+state key can't steal a row another entry
 * already claimed. `type` (GOVERNMENT/PRIVATE) comes from the source's
 * Management column via the same lenient "strip non-letters, check for
 * govt/govern as a substring" detection used elsewhere.
 *
 * Idempotent — re-running just ensures each college's University row
 * exists and has `levels` including "UG" (pushed if missing), rather
 * than duplicating.
 *
 * Usage:
 *   node scripts/seed-bds-colleges.mjs            # write
 *   node scripts/seed-bds-colleges.mjs --dry-run   # report only
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
  const colleges = JSON.parse(await readFile(path.join(DATA, 'bds-colleges.json'), 'utf8'));

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const existing = await prisma.university.findMany({
    select: { id: true, name: true, state: true, slug: true, levels: true, stream: true },
  });
  // Pre-existing rows may repeat a name+state key across genuinely
  // distinct branches — this holds every candidate, not just one.
  const existingByNameState = new Map();
  for (const u of existing) {
    const key = `${u.name.toLowerCase().trim()}|${u.state.toLowerCase().trim()}`;
    const list = existingByNameState.get(key);
    if (list) list.push(u);
    else existingByNameState.set(key, [u]);
  }
  const claimed = new Set();
  const createdThisRun = new Map();
  const taken = new Set(existing.map((u) => u.slug));

  const stats = { matched: 0, created: 0, levelsUpdated: 0 };

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
      if (!university.levels.includes('UG')) {
        if (!DRY_RUN) {
          await prisma.university.update({
            where: { id: university.id },
            data: { levels: { push: 'UG' } },
          });
        }
        stats.levelsUpdated += 1;
      }
    } else {
      const slug = await uniqueSlug(c.name, taken);
      if (!DRY_RUN) {
        university = await prisma.university.create({
          data: {
            name: c.name,
            slug,
            type: c.type,
            state: c.state,
            // Unlike DNB/DM-MCh/Diploma (where district lives on
            // Program.description, since one University can have several
            // degree-specific Programs each with their own district),
            // BDS has no Program row at all -- University.city is the
            // right place for it here.
            city: c.district || null,
            stream: 'Dental',
            levels: ['UG'],
            isActive: true,
          },
        });
      } else {
        university = { id: `dry-run:${slug}` };
      }
      createdThisRun.set(branchKey, university);
      stats.created += 1;
    }
  }

  console.log(
    `Universities: ${stats.matched} matched existing, ${stats.created} created, ` +
      `${stats.levelsUpdated} had UG added to levels.` +
      (DRY_RUN ? '\n(dry run — nothing written)' : ''),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
