/**
 * Seed DM/MCh super-specialty colleges + their accredited specializations
 * from NMC's Super-Specialty Seat Matrix (see scripts/data/README.md for
 * provenance).
 *
 * Own distinct dataset — unlike PG/MD-MS/Doctorate (which all share the
 * MD/MS Program, see seed-pg-mdms-colleges.mjs), DM/MCh gets its own
 * Program row per college and is not shared with any other Degree option.
 *
 * Matching/creation rules mirror seed-dnb-colleges.mjs: finds an existing
 * University by name+state match (case-insensitive), creates a new one
 * otherwise. `type` defaults to PRIVATE — this refreshed source has no
 * ownership/management column (unlike the original version of this
 * dataset), so it can't state real ownership anymore.
 *
 * Branch disambiguation: this source has a District column, so — same as
 * seed-dnb-colleges.mjs after a real data-corruption incident there —
 * `existingByNameState` holds every pre-existing candidate for a
 * name+state key (not just one), and a `claimed` set tracks which
 * candidate an earlier JSON entry in this run already reused, so a
 * different district under the same name+state can't steal a row another
 * district already claimed. Rows created during this run are tracked
 * separately, keyed by name+state+district.
 *
 * Idempotent — keyed on (university match) + Program's
 * @@unique([universityId, name]), so a re-run updates specializations in
 * place instead of duplicating. The update clause also sets
 * isActive: true, so a re-run correctly revives a row that had been
 * deactivated (e.g. as part of a clean-slate re-seed).
 *
 * Usage:
 *   node scripts/seed-dm-mch-colleges.mjs            # write
 *   node scripts/seed-dm-mch-colleges.mjs --dry-run   # report only
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
// `degree.toUpperCase()` lookup — "DM/MCh".toUpperCase() is "DM/MCH", so
// storing anything but that exact casing here would never match.
const PROGRAM_NAME = 'DM/MCH';

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
  const colleges = JSON.parse(await readFile(path.join(DATA, 'dm-mch-colleges.json'), 'utf8'));

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
    // instead (unused Text field), same convention as seed-dnb-colleges.mjs.
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
      `DM/MCh programs: ${stats.programsCreated} created, ${stats.programsUpdated} updated.` +
      (DRY_RUN ? '\n(dry run — nothing written)' : ''),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
