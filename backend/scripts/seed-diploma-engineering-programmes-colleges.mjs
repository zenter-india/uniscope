/**
 * Seed Diploma Engineering (polytechnic) colleges + their per-college
 * specializations (Specialization column of an NBA-style extract, see
 * scripts/data/README.md for provenance). Same upgrade
 * seed-btech-programmes-colleges.mjs / seed-mtech-programmes-colleges.mjs
 * did for B.Tech/M.Tech — replaces the no-specialization University-only
 * pattern (seed-diploma-engineering-colleges.mjs) with the curated
 * University+Program pattern.
 *
 * District-aware `claimed`-set branch disambiguation, mirroring
 * seed-btech-programmes-colleges.mjs.
 *
 * STREAM-AWARE MATCHING (see scripts/data/README.md's cross-stream
 * matching gap section): candidates are restricted to University rows
 * whose `stream` is already 'Engineering' or unset.
 *
 * PUNCTUATION-INSENSITIVE MATCHING (see scripts/data/README.md's
 * "punctuation-insensitive matching" section): matching key uses
 * normalizeForMatch(), not a plain name.toLowerCase().trim().
 *
 * NAME-GENERATION CONSISTENCY (see scripts/data/README.md's
 * law-ug-programmes-colleges.json section — a real bug found there, and
 * the lesson applied proactively here): the JSON this script reads was
 * generated using diploma-engineering-colleges.json's own original
 * strict district-exact-match truncation heuristic (not the Law
 * datasets' looser locality_like rule) — verified before generating
 * that this is in fact the heuristic that already aligns with the
 * already-seeded rows (only 1/364 mismatch either direction, both
 * explained as legitimate new branches, not a naming bug).
 *
 * Reuses University rows already created by
 * seed-diploma-engineering-colleges.mjs (same college, matched by
 * name+state+district) — pushes "Diploma" onto `levels` if somehow
 * missing (this dataset's convention, not "UG"/"PG" — see that script's
 * own header comment). Creates a 'DIPLOMA-ENGG' Program row per college
 * (uppercase — see the casing-bug note in scripts/data/README.md;
 * deliberately distinct from Medical's 'DIPLOMA' Program name, even
 * though Program uniqueness is scoped per-University so there's no
 * technical collision risk — kept distinct for clarity when
 * debugging/browsing the DB), specializations from the source,
 * description = district.
 *
 * Idempotent — Program's @@unique([universityId, name]) means a re-run
 * updates specializations in place rather than duplicating; the update
 * clause also sets isActive: true so a re-run revives a deactivated row.
 *
 * Usage:
 *   node scripts/seed-diploma-engineering-programmes-colleges.mjs            # write
 *   node scripts/seed-diploma-engineering-programmes-colleges.mjs --dry-run   # report only
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
const PROGRAM_NAME = 'DIPLOMA-ENGG';
const TARGET_STREAM = 'Engineering';

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
    await readFile(path.join(DATA, 'diploma-engineering-programmes-colleges.json'), 'utf8'),
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
      if (!university.levels.includes('Diploma')) {
        if (!DRY_RUN) {
          await prisma.university.update({
            where: { id: university.id },
            data: { levels: { push: 'Diploma' } },
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
            levels: ['Diploma'],
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
      `${stats.levelsUpdated} had Diploma added to levels.\n` +
      `DIPLOMA-ENGG programs: ${stats.programsCreated} created, ${stats.programsUpdated} updated.` +
      (DRY_RUN ? '\n(dry run — nothing written)' : ''),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
