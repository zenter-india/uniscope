/**
 * Seed DM/MCh super-specialty colleges + their accredited specializations
 * from NMC's Super-Specialty Seat Matrix (see scripts/data/README.md for
 * provenance).
 *
 * Own distinct dataset — unlike PG/MD-MS/Doctorate (which all share the
 * MD/MS Program, see seed-pg-mdms-colleges.mjs), DM/MCh gets its own
 * Program row per college and is not shared with any other Degree option.
 *
 * Matching/creation rules mirror seed-dnb-colleges.mjs and
 * seed-pg-mdms-colleges.mjs: finds an existing University by exact
 * name+state match (case-insensitive), creates a new one otherwise. `type`
 * comes from the source data itself (GOVERNMENT/PRIVATE), same as the
 * MD/MS seed — this source states real ownership too, though see the data
 * file's own README note on this specific source's noisier OCR quality.
 *
 * Idempotent — keyed on (university match) + Program's
 * @@unique([universityId, name]), so a re-run updates specializations in
 * place instead of duplicating.
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
const PROGRAM_NAME = 'DM/MCh';

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
  const byNameState = new Map(
    existing.map((u) => [`${u.name.toLowerCase().trim()}|${u.state.toLowerCase().trim()}`, u]),
  );
  const taken = new Set(existing.map((u) => u.slug));

  const stats = { matched: 0, created: 0, programsCreated: 0, programsUpdated: 0 };

  for (const c of colleges) {
    const key = `${c.name.toLowerCase().trim()}|${c.state.toLowerCase().trim()}`;
    let university = byNameState.get(key);

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
            type: c.type,
            state: c.state,
            city: null,
            stream: 'Medical',
            levels: ['PG'],
            isActive: true,
          },
        });
      } else {
        university = { id: `dry-run:${slug}` };
      }
      byNameState.set(key, university);
      stats.created += 1;
    }

    if (!DRY_RUN) {
      const priorProgram = await prisma.program.findUnique({
        where: { universityId_name: { universityId: university.id, name: PROGRAM_NAME } },
      });
      await prisma.program.upsert({
        where: { universityId_name: { universityId: university.id, name: PROGRAM_NAME } },
        update: { specializations: c.specializations },
        create: {
          universityId: university.id,
          name: PROGRAM_NAME,
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
      `DM/MCh programs: ${stats.programsCreated} created, ${stats.programsUpdated} updated.` +
      (DRY_RUN ? '\n(dry run — nothing written)' : ''),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
