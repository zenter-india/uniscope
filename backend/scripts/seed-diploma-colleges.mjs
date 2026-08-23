/**
 * Seed Diploma colleges + their accredited specializations from the NBEMS
 * Diploma accreditation extract (see scripts/data/README.md for
 * provenance). Own separate dataset — not merged with any other degree.
 *
 * Matching/creation rules mirror seed-dnb-colleges.mjs: finds an existing
 * University by exact name+state match (case-insensitive), creates a new
 * one otherwise. `type` defaults to PRIVATE since, like the DNB source,
 * this data doesn't state ownership.
 *
 * Unlike DNB, this source has no district/address column at all — just
 * college name, state, and specialization — so generic hospital names
 * that repeat within a state (e.g. "District Hospital" appearing many
 * times in Karnataka) can't be told apart as distinct branches; they're
 * grouped into one college entry by name+state (see the data-generation
 * step in scripts/data/README.md). Given that, name+state IS this
 * dataset's branch key — but pre-existing rows are still tracked with a
 * "claimed" set (same fix applied to seed-dnb-colleges.mjs after a real
 * data-corruption incident there) so that if the *same* name+state ever
 * appears twice in the JSON, the second occurrence doesn't silently
 * overwrite the first upsert's data.
 *
 * Idempotent — keyed on (university match) + Program's
 * @@unique([universityId, name]), so a re-run updates specializations in
 * place instead of duplicating. The update clause also sets
 * isActive: true, so a re-run correctly revives a row that had been
 * deactivated (e.g. as part of a clean-slate re-seed).
 *
 * Usage:
 *   node scripts/seed-diploma-colleges.mjs            # write
 *   node scripts/seed-diploma-colleges.mjs --dry-run   # report only
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
const PROGRAM_NAME = 'DIPLOMA';

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
  const colleges = JSON.parse(await readFile(path.join(DATA, 'diploma-colleges.json'), 'utf8'));

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const existing = await prisma.university.findMany({
    select: { id: true, name: true, state: true, slug: true, levels: true },
  });
  // Pre-existing rows may repeat a name+state key (see header comment) —
  // this holds every candidate, not just one.
  const existingByNameState = new Map();
  for (const u of existing) {
    const key = `${u.name.toLowerCase().trim()}|${u.state.toLowerCase().trim()}`;
    const list = existingByNameState.get(key);
    if (list) list.push(u);
    else existingByNameState.set(key, [u]);
  }
  // Pre-existing University ids already reused by an earlier JSON entry in
  // this run — prevents a repeated name+state key from stealing a row
  // another entry already claimed.
  const claimed = new Set();
  const createdThisRun = new Map();
  const taken = new Set(existing.map((u) => u.slug));

  const stats = { matched: 0, created: 0, programsCreated: 0, programsUpdated: 0 };

  for (const c of colleges) {
    const nameStateKey = `${c.name.toLowerCase().trim()}|${c.state.toLowerCase().trim()}`;
    const branchKey = nameStateKey;
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

    if (!DRY_RUN) {
      const priorProgram = await prisma.program.findUnique({
        where: { universityId_name: { universityId: university.id, name: PROGRAM_NAME } },
      });
      await prisma.program.upsert({
        where: { universityId_name: { universityId: university.id, name: PROGRAM_NAME } },
        update: { specializations: c.specializations, isActive: true },
        create: {
          universityId: university.id,
          name: PROGRAM_NAME,
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
      `Diploma programs: ${stats.programsCreated} created, ${stats.programsUpdated} updated.` +
      (DRY_RUN ? '\n(dry run — nothing written)' : ''),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
