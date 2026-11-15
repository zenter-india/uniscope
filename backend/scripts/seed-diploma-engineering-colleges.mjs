/**
 * Seed Diploma Engineering (polytechnic) colleges (see
 * scripts/data/README.md for provenance). Like seed-btech-colleges.mjs
 * and seed-pg-engineering-colleges.mjs, this source has no
 * specialization data — just a plain college list — so this only
 * creates/updates University rows, no Program rows. `type` defaults to
 * PRIVATE since this source has no ownership/management column at all.
 *
 * Matching/creation rules mirror seed-btech-colleges.mjs: finds an
 * existing University by name+state match (case-insensitive), with
 * pre-existing rows tracked via a "claimed" set so a repeated
 * name+state key can't steal a row another entry already claimed.
 * Where available, district goes on `University.city`.
 *
 * Many of these colleges also offer B.Tech/M.Tech and will already
 * exist as University rows from those seeds — matching correctly
 * pushes "Diploma" onto their `levels` rather than duplicating.
 * `levels` is a free-form string array (not an enum) — see
 * University.levels' doc comment in schema.prisma; every other
 * dataset here has only ever used "UG"/"PG", this is the first to add
 * "Diploma" as a level value.
 *
 * Idempotent — re-running just ensures each college's University row
 * exists and has `levels` including "Diploma" (pushed if missing),
 * rather than duplicating.
 *
 * Usage:
 *   node scripts/seed-diploma-engineering-colleges.mjs            # write
 *   node scripts/seed-diploma-engineering-colleges.mjs --dry-run   # report only
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
  const colleges = JSON.parse(
    await readFile(path.join(DATA, 'diploma-engineering-colleges.json'), 'utf8'),
  );

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const existing = await prisma.university.findMany({
    select: { id: true, name: true, state: true, slug: true, levels: true },
  });
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
            stream: 'Engineering',
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
  }

  console.log(
    `Universities: ${stats.matched} matched existing, ${stats.created} created, ` +
      `${stats.levelsUpdated} had Diploma added to levels.` +
      (DRY_RUN ? '\n(dry run — nothing written)' : ''),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
