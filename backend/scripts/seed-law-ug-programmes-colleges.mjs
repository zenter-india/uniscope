/**
 * Seed UG Law colleges + their per-college specializations (the specific
 * UG law programme type each college offers — B.A. LL.B., LL.B., BBA
 * LL.B., etc.) from an AISHE programme-level export with an explicit
 * Specialization column (see scripts/data/README.md for provenance).
 * Same upgrade seed-btech-programmes-colleges.mjs / seed-mtech-programmes
 * -colleges.mjs did for Engineering — replaces the no-specialization
 * University-only pattern (seed-law-ug-colleges.mjs) with the same
 * curated University+Program pattern Medical's MD/MS/DNB/Diploma/DM-MCh,
 * Dental's MDS, and Engineering's B.Tech/M.Tech use.
 *
 * District-aware `claimed`-set branch disambiguation, mirroring
 * seed-btech-programmes-colleges.mjs.
 *
 * STREAM-AWARE MATCHING (see scripts/data/README.md's cross-stream
 * matching gap section — the reason this convention exists at all):
 * candidates are restricted to University rows whose `stream` is already
 * 'Law' or unset, same fix already applied to seed-law-ug-colleges.mjs
 * and seed-pg-law-colleges.mjs.
 *
 * PUNCTUATION-INSENSITIVE MATCHING (see scripts/data/README.md's
 * "punctuation-insensitive matching" section): matching key uses
 * normalizeForMatch(), not a plain name.toLowerCase().trim() — this
 * source is the exact same underlying data as law-ug-colleges.json (just
 * with a Specialization column added), so matching keys should align
 * closely, but the stricter normalization is used for safety/consistency
 * with every other Programmes-pattern script.
 *
 * Reuses University rows already created by seed-law-ug-colleges.mjs
 * (same college, matched by name+state+district) — pushes "UG" onto
 * `levels` if somehow missing. Creates a 'LAW-UG' Program row per
 * college (uppercase — see the casing-bug note in
 * scripts/data/README.md; deliberately not just "UG" to avoid ambiguity
 * with the Degree option value of the same name), specializations from
 * the source, description = district (same convention as
 * DNB/DM-MCh/Diploma/MDS/B.TECH/M.TECH).
 *
 * Idempotent — Program's @@unique([universityId, name]) means a re-run
 * updates specializations in place rather than duplicating; the update
 * clause also sets isActive: true so a re-run revives a deactivated row.
 *
 * Usage:
 *   node scripts/seed-law-ug-programmes-colleges.mjs            # write
 *   node scripts/seed-law-ug-programmes-colleges.mjs --dry-run   # report only
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
const PROGRAM_NAME = 'LAW-UG';
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
    await readFile(path.join(DATA, 'law-ug-programmes-colleges.json'), 'utf8'),
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
            city: c.district || null,
            stream: TARGET_STREAM,
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
      `${stats.levelsUpdated} had UG added to levels.\n` +
      `LAW-UG programs: ${stats.programsCreated} created, ${stats.programsUpdated} updated.` +
      (DRY_RUN ? '\n(dry run — nothing written)' : ''),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
