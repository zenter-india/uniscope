/**
 * Seed MDS (Dental PG) colleges + their accredited specializations (see
 * scripts/data/README.md for provenance). Unlike BDS (the base dental UG
 * degree, no specializations at all), MDS is a postgrad specialty
 * program with real specialization data, so this creates/updates both
 * `University` rows and a "MDS" `Program` row per college, mirroring
 * seed-dnb-colleges.mjs.
 *
 * Matching/creation rules mirror seed-dnb-colleges.mjs exactly: finds an
 * existing University by name+state match (case-insensitive), with
 * pre-existing rows tracked via a "claimed" set (see that file's header
 * comment for why) — a repeated name+state key across different
 * districts can't steal a row another district already claimed. Many
 * MDS colleges already exist as University rows from the BDS seed
 * (same physical college, same name+state) — matching those correctly
 * pushes "PG" onto their `levels` (they'll have `levels: ['UG']` from
 * BDS already) rather than creating a duplicate row.
 *
 * `type` (GOVERNMENT/PRIVATE) comes from the source's own "Colleges"
 * sheet (joined by name+state at generation time — see
 * scripts/data/README.md), same lenient govt/govern substring detection
 * used elsewhere.
 *
 * Idempotent — keyed on (university match) + Program's
 * @@unique([universityId, name]), so a re-run updates specializations in
 * place instead of duplicating. The update clause also sets
 * isActive: true, so a re-run correctly revives a row that had been
 * deactivated (e.g. as part of a clean-slate re-seed).
 *
 * Usage:
 *   node scripts/seed-mds-colleges.mjs            # write
 *   node scripts/seed-mds-colleges.mjs --dry-run   # report only
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
// Uppercase to match UniversitiesService.findCurated's
// `degree.toUpperCase()` lookup.
const PROGRAM_NAME = 'MDS';

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
  const colleges = JSON.parse(await readFile(path.join(DATA, 'mds-colleges.json'), 'utf8'));

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const existing = await prisma.university.findMany({
    select: { id: true, name: true, state: true, slug: true, levels: true },
  });
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
  // Rows created during this run, keyed by name+state+district so distinct
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
            type: c.type,
            state: c.state,
            city: c.district || null,
            stream: 'Dental',
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

    // District has no dedicated University column — carried on the
    // Program instead (unused Text field), same convention as
    // seed-dnb-colleges.mjs. (A newly-created University here also gets
    // it on `city`, matching seed-bds-colleges.mjs, since a brand-new
    // Dental college has no other Program to conflict with.)
    if (!DRY_RUN) {
      const priorProgram = await prisma.program.findUnique({
        where: { universityId_name: { universityId: university.id, name: PROGRAM_NAME } },
      });
      await prisma.program.upsert({
        where: { universityId_name: { universityId: university.id, name: PROGRAM_NAME } },
        update: { description: c.district, specializations: c.specializations, isActive: true },
        create: {
          universityId: university.id,
          name: PROGRAM_NAME,
          description: c.district,
          specializations: c.specializations,
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
    `Universities: ${stats.matched} matched existing, ${stats.created} created.\n` +
      `MDS programs: ${stats.programsCreated} created, ${stats.programsUpdated} updated.` +
      (DRY_RUN ? '\n(dry run — nothing written)' : ''),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
