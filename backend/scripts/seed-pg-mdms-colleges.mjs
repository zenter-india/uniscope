/**
 * Seed MD/MS colleges + their accredited specializations from NMC's PG
 * Broad Specialty Seat Matrix (see scripts/data/README.md for provenance).
 *
 * Shared by three Degree options on the mentor form — PG, MD/MS, and
 * Doctorate all query this same "MD/MS" Program (see MentorForm.tsx's
 * CURATED_DEGREE_MAP) since this is the only real postgrad specialty data
 * available today; there's no separate PG- or Doctorate-specific dataset.
 *
 * Matching/creation rules mirror seed-dnb-colleges.mjs: finds an existing
 * University by name+state match (case-insensitive). Unlike the DNB seed,
 * `type` comes from the source data itself (GOVERNMENT/PRIVATE), not a
 * default — this dataset states real ownership.
 *
 * This source has no district/address column (like Diploma's second
 * refresh), so branch disambiguation by location isn't possible — but
 * pre-existing rows are still tracked with a "claimed" set (the fix
 * applied to seed-dnb-colleges.mjs after a real data-corruption incident
 * there) so a repeated name+state key within the same run can't steal a
 * row another entry already claimed.
 *
 * Idempotent — keyed on (university match) + Program's
 * @@unique([universityId, name]), so a re-run updates specializations in
 * place instead of duplicating. The update clause also sets
 * isActive: true, so a re-run correctly revives a row that had been
 * deactivated (e.g. as part of a clean-slate re-seed).
 *
 * Usage:
 *   node scripts/seed-pg-mdms-colleges.mjs            # write
 *   node scripts/seed-pg-mdms-colleges.mjs --dry-run   # report only
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
const PROGRAM_NAME = 'MD/MS';

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
  const colleges = JSON.parse(await readFile(path.join(DATA, 'pg-mdms-colleges.json'), 'utf8'));

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const existing = await prisma.university.findMany({
    select: { id: true, name: true, state: true, slug: true, levels: true },
  });
  // Pre-existing rows may repeat a name+state key — this holds every
  // candidate, not just one.
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
    const key = `${c.name.toLowerCase().trim()}|${c.state.toLowerCase().trim()}`;
    const candidates = existingByNameState.get(key) ?? [];
    const unclaimedCandidate = candidates.find((u) => !claimed.has(u.id));
    let university = createdThisRun.get(key) ?? unclaimedCandidate;

    if (university) {
      if (!createdThisRun.has(key)) {
        claimed.add(university.id);
        createdThisRun.set(key, university);
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
            city: null,
            stream: 'Medical',
            levels: ['PG'],
            isActive: true,
          },
        });
      } else {
        university = { id: `dry-run:${slug}`, levels: ['PG'] };
      }
      createdThisRun.set(key, university);
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
      `MD/MS programs: ${stats.programsCreated} created, ${stats.programsUpdated} updated.` +
      (DRY_RUN ? '\n(dry run — nothing written)' : ''),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
