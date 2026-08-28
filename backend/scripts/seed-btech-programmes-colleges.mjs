/**
 * Seed B.Tech/B.E colleges + their per-college specializations (Discipline
 * column) from an AISHE programme-level export (see scripts/data/README.md
 * for provenance). Upgrades B.Tech/B.E from the plain University-only
 * pattern (seed-btech-colleges.mjs, no specialization concept) to the same
 * curated University+Program pattern Medical's MD/MS/DNB/Diploma/DM-MCh and
 * Dental's MDS use — picking a college now shows that college's own real
 * specialization list, same UX, via CuratedCollegeSearch.
 *
 * District-aware `claimed`-set branch disambiguation, mirroring
 * seed-dnb-colleges.mjs / seed-diploma-colleges.mjs.
 *
 * IMPORTANT — stream-aware matching (new for this script, not present in
 * earlier seed scripts this session): candidates are restricted to
 * University rows whose `stream` is already 'Engineering' or null/unset.
 * This exists specifically because seed-pg-law-colleges.mjs and
 * seed-law-ug-colleges.mjs (name+state-only matching, no stream check)
 * were found to silently push a Law-stream level value onto pre-existing
 * Engineering-stream rows for colleges that legitimately appear in both a
 * B.Tech and a Law dataset (e.g. IILM University, Integral University) —
 * inflating the Engineering-stream college search with rows that don't
 * actually offer that Engineering degree. This script deliberately excludes
 * a candidate whose `stream` is already set to something else, so it
 * creates a separate University row for Engineering instead of polluting
 * the other stream's row. Older seed scripts in this pipeline are NOT
 * retroactively fixed — see scripts/data/README.md's cross-stream matching
 * gap section.
 *
 * Reuses University rows already created by seed-btech-colleges.mjs (same
 * college, matched by name+state+district) — pushes "UG" onto `levels` if
 * missing, same as that script would have. Creates a 'B.TECH' Program row
 * per college (uppercase — see the casing-bug note in
 * scripts/data/README.md; UniversitiesService.findCurated queries
 * `degree.toUpperCase()`), specializations from the source, description =
 * district (same convention as DNB/DM-MCh/Diploma/MDS).
 *
 * Idempotent — Program's @@unique([universityId, name]) means a re-run
 * updates specializations in place rather than duplicating; the update
 * clause also sets isActive: true so a re-run revives a deactivated row.
 *
 * Usage:
 *   node scripts/seed-btech-programmes-colleges.mjs            # write
 *   node scripts/seed-btech-programmes-colleges.mjs --dry-run   # report only
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
const PROGRAM_NAME = 'B.TECH';
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

async function main() {
  const colleges = JSON.parse(
    await readFile(path.join(DATA, 'btech-programmes-colleges.json'), 'utf8'),
  );

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const existing = await prisma.university.findMany({
    select: { id: true, name: true, state: true, slug: true, levels: true, stream: true },
  });
  // Stream-aware: only rows already Engineering or unclassified (stream
  // null) are eligible matches. A row already claimed by a different
  // stream (e.g. Law) is excluded here, so this script creates its own
  // Engineering row for that college instead of polluting the other
  // stream's row further — see the header comment above.
  const eligible = existing.filter((u) => u.stream === TARGET_STREAM || u.stream === null);
  const existingByNameState = new Map();
  for (const u of eligible) {
    const key = `${u.name.toLowerCase().trim()}|${u.state.toLowerCase().trim()}`;
    const list = existingByNameState.get(key);
    if (list) list.push(u);
    else existingByNameState.set(key, [u]);
  }
  const claimed = new Set();
  const createdThisRun = new Map();
  const taken = new Set(existing.map((u) => u.slug));

  const stats = { matched: 0, created: 0, levelsUpdated: 0, programsCreated: 0, programsUpdated: 0 };

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
      `B.TECH programs: ${stats.programsCreated} created, ${stats.programsUpdated} updated.` +
      (DRY_RUN ? '\n(dry run — nothing written)' : ''),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
