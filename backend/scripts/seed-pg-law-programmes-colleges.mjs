/**
 * Seed PG Law colleges + their per-college specializations (LL.M./M.L.
 * and the specific super-specialty, e.g. "LL.M. - Constitutional Law")
 * from an AISHE programme-level export with an explicit Specialization
 * column (see scripts/data/README.md for provenance). Same upgrade
 * seed-law-ug-programmes-colleges.mjs did for UG Law — replaces the
 * no-specialization University-only pattern (seed-pg-law-colleges.mjs)
 * with the same curated University+Program pattern Medical's MD/MS/DNB/
 * Diploma/DM-MCh, Dental's MDS, Engineering's B.Tech/M.Tech, and Law's
 * UG now use.
 *
 * District-aware `claimed`-set branch disambiguation, mirroring
 * seed-law-ug-programmes-colleges.mjs.
 *
 * STREAM-AWARE MATCHING (see scripts/data/README.md's cross-stream
 * matching gap section): candidates are restricted to University rows
 * whose `stream` is already 'Law' or unset.
 *
 * PUNCTUATION-INSENSITIVE MATCHING (see scripts/data/README.md's
 * "punctuation-insensitive matching" section): matching key uses
 * normalizeForMatch(), not a plain name.toLowerCase().trim().
 *
 * NAME-GENERATION CONSISTENCY (see scripts/data/README.md's
 * law-ug-programmes-colleges.json section — a real bug found there):
 * the JSON this script reads was generated using pg-law-colleges.json's
 * own original locality_like truncation heuristic, not the stricter
 * district-exact-match rule used for Engineering — verified zero
 * name+state mismatches against pg-law-colleges.json before this script
 * was ever run, so this script's matching should see a near-100% match
 * rate against the already-seeded rows, not create near-duplicates.
 *
 * Reuses University rows already created by seed-pg-law-colleges.mjs
 * (same college, matched by name+state+district) — pushes "PG" onto
 * `levels` if somehow missing. Creates a 'LAW-PG' Program row per
 * college (uppercase — see the casing-bug note in
 * scripts/data/README.md), specializations from the source,
 * description = district.
 *
 * Idempotent — Program's @@unique([universityId, name]) means a re-run
 * updates specializations in place rather than duplicating; the update
 * clause also sets isActive: true so a re-run revives a deactivated row.
 *
 * Usage:
 *   node scripts/seed-pg-law-programmes-colleges.mjs            # write
 *   node scripts/seed-pg-law-programmes-colleges.mjs --dry-run   # report only
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
const PROGRAM_NAME = 'LAW-PG';
const TARGET_STREAM = 'Law';

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

/**
 * Punctuation/spacing-insensitive normalization for cross-file matching —
 * see the header comment above and scripts/data/README.md's
 * "punctuation-insensitive matching" section for why this exists.
 */
function normalizeForMatch(name) {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

async function main() {
  const colleges = JSON.parse(
    await readFile(path.join(DATA, 'pg-law-programmes-colleges.json'), 'utf8'),
  );

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const existing = await prisma.university.findMany({
    select: { id: true, name: true, state: true, slug: true, levels: true, stream: true },
  });
  const eligible = existing.filter((u) => u.stream === TARGET_STREAM || u.stream === null);
  const existingByNameState = new Map();
  for (const u of eligible) {
    const key = `${normalizeForMatch(u.name)}|${u.state.toLowerCase().trim()}`;
    const list = existingByNameState.get(key);
    if (list) list.push(u);
    else existingByNameState.set(key, [u]);
  }
  const claimed = new Set();
  const createdThisRun = new Map();
  const taken = new Set(existing.map((u) => u.slug));

  const stats = { matched: 0, created: 0, levelsUpdated: 0, programsCreated: 0, programsUpdated: 0 };

  for (const c of colleges) {
    const nameStateKey = `${normalizeForMatch(c.name)}|${c.state.toLowerCase().trim()}`;
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
            city: c.district || null,
            stream: TARGET_STREAM,
            levels: ['PG'],
            isActive: true,
          },
        });
      } else {
        university = { id: `dry-run:${slug}` };
      }
      createdThisRun.set(branchKey, university);
      stats.created += 1;
    }

    if (!DRY_RUN) {
      const priorProgram = await prisma.program.findUnique({
        where: { universityId_name: { universityId: university.id, name: PROGRAM_NAME } },
      });
      await prisma.program.upsert({
        where: { universityId_name: { universityId: university.id, name: PROGRAM_NAME } },
        update: { specializations: c.specializations, description: c.district || null, isActive: true },
        create: {
          universityId: university.id,
          name: PROGRAM_NAME,
          specializations: c.specializations,
          description: c.district || null,
          isActive: true,
        },
      });
      if (priorProgram) stats.programsUpdated += 1;
      else stats.programsCreated += 1;
    } else {
      stats.programsCreated += 1;
    }
  }

  console.log(
    `Universities: ${stats.matched} matched existing, ${stats.created} created, ` +
      `${stats.levelsUpdated} had PG added to levels.\n` +
      `LAW-PG programs: ${stats.programsCreated} created, ${stats.programsUpdated} updated.` +
      (DRY_RUN ? '\n(dry run — nothing written)' : ''),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
