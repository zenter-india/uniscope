/**
 * Remediates duplicate `University` rows created by the real
 * seed-btech-programmes-colleges.mjs / seed-mtech-programmes-colleges.mjs
 * runs, caused by a since-fixed bug: the AISHE source's `College Name`
 * cell bakes a full street address into some rows, and the "strict,
 * exact-district-match-only" truncation heuristic used to generate
 * btech-programmes-colleges.json / mtech-programmes-colleges.json only
 * strips a trailing comma segment when it's a literal district-name
 * repeat -- so any row with a genuine street address tail (not a bare
 * district repeat) kept its full address baked into `name`, failed to
 * normalizeForMatch() against the already-seeded clean-named row, and
 * got CREATED as a brand-new duplicate University instead of matched.
 * See scripts/data/README.md's "stray quotation marks" section (the
 * quote character was just an incidental symptom on some of these --
 * this is the real underlying bug, much larger in scope) for the full
 * writeup and how this was found.
 *
 * Reads scripts/data/btech-mtech-programmes-dedup-mapping.json -- for
 * every row in the ORIGINAL (pre-fix) btech-programmes-colleges.json /
 * mtech-programmes-colleges.json whose name got truncated by the fix
 * (comma-containing name, and its first comma-segment + state maps to
 * exactly one district file-wide, i.e. safe to truncate with no
 * disambiguation need), records {old_name, new_name, district, state}.
 * This script groups those by (new_name, state, district) across BOTH
 * files -- a college can have gotten a *separate* broken row created
 * once per seed run (B.Tech run and M.Tech run each read their own
 * JSON's name field, so if both were broken and different, up to two
 * duplicate rows could exist for the same real college) -- so every
 * group is resolved against ONE canonical target, whichever broken rows
 * exist within it.
 *
 * For each group:
 *   1. Find the canonical University: exact normalizeForMatch(name) ==
 *      normalizeForMatch(new_name), same state, stream Engineering-or-
 *      null. This should be the pre-existing row from
 *      seed-btech-colleges.mjs / seed-pg-engineering-colleges.mjs /
 *      seed-diploma-engineering-colleges.mjs (the narrower, clean-named
 *      sources) -- NOT a row created by the two Programmes runs
 *      (excluded via the `taken from the group's own old_name set`
 *      check) below.
 *   2. For each broken old_name in the group that has a matching
 *      University row (exact `name` match -- these were create()'d
 *      verbatim from the pre-fix JSON, so an exact string match is
 *      reliable):
 *      - If no canonical row exists for this group, this wasn't a
 *        duplicate after all (genuinely new AISHE-only college) --
 *        just rename the broken row's `name` to `new_name` in place.
 *        No merge, nothing deactivated.
 *      - If a canonical row exists and it's a DIFFERENT id from the
 *        broken row: migrate every Program row on the broken University
 *        onto the canonical University (upsert by
 *        universityId_name, specializations = union of both sides if
 *        the canonical already has one of the same name, isActive:
 *        true), deactivate the migrated Program row on the broken
 *        University (isActive: false -- never deleted), push any
 *        levels the broken row had onto canonical if missing, then
 *        deactivate the broken University row itself (isActive: false
 *        -- never deleted, consistent with this project's non-
 *        destructive data model).
 *
 * Idempotent-ish: re-running after a partial/failed run is safe -- a
 * broken row already renamed or deactivated is simply not touched again
 * (renamed rows won't match any old_name lookup a second time; the
 * university.findMany at top always re-reads current state).
 *
 * Usage:
 *   node scripts/fix-btech-mtech-programmes-duplicates.mjs            # write
 *   node scripts/fix-btech-mtech-programmes-duplicates.mjs --dry-run   # report only
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

function normalizeForMatch(name) {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

async function main() {
  const mapping = JSON.parse(
    await readFile(path.join(DATA, 'btech-mtech-programmes-dedup-mapping.json'), 'utf8'),
  );

  // Group all (old_name -> new_name) pairs from both files by
  // (normalizeForMatch(new_name), state, district) -- a college that
  // got broken in both B.Tech's and M.Tech's own JSON collapses into
  // one group here.
  const groups = new Map();
  for (const [, changes] of Object.entries(mapping)) {
    for (const c of changes) {
      const key = `${normalizeForMatch(c.new_name)}|${c.state.toLowerCase().trim()}|${c.district.toLowerCase().trim()}`;
      if (!groups.has(key)) {
        groups.set(key, { new_name: c.new_name, state: c.state, district: c.district, old_names: new Set() });
      }
      groups.get(key).old_names.add(c.old_name);
    }
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const existing = await prisma.university.findMany({
    where: { OR: [{ stream: 'Engineering' }, { stream: null }] },
    select: { id: true, name: true, state: true, city: true, levels: true, isActive: true },
  });
  const byExactName = new Map();
  for (const u of existing) {
    const list = byExactName.get(u.name) ?? [];
    list.push(u);
    byExactName.set(u.name, list);
  }
  const byNormKey = new Map();
  for (const u of existing) {
    const key = `${normalizeForMatch(u.name)}|${u.state.toLowerCase().trim()}`;
    const list = byNormKey.get(key) ?? [];
    list.push(u);
    byNormKey.set(key, list);
  }

  const stats = { groupsProcessed: 0, renamedOnly: 0, merged: 0, brokenRowsSkippedNotFound: 0, programsMigrated: 0, programsDeactivated: 0 };
  const report = [];

  for (const [, group] of groups) {
    const brokenRows = [];
    for (const oldName of group.old_names) {
      const rows = byExactName.get(oldName) ?? [];
      for (const r of rows) brokenRows.push(r);
    }
    if (brokenRows.length === 0) continue; // nothing live under any old broken name -- was matched fine originally
    stats.groupsProcessed += 1;

    const normKey = `${normalizeForMatch(group.new_name)}|${group.state.toLowerCase().trim()}`;
    const brokenIds = new Set(brokenRows.map((r) => r.id));
    const canonicalCandidates = (byNormKey.get(normKey) ?? []).filter((u) => !brokenIds.has(u.id));
    const canonical = canonicalCandidates[0]; // narrower clean-named sources have exactly one row per (name, state) in practice

    if (!canonical) {
      // No pre-existing clean row -- this was a genuinely new AISHE-only
      // college, not a duplicate. Just fix the name in place.
      for (const broken of brokenRows) {
        report.push({ action: 'rename', from: broken.name, to: group.new_name });
        if (!DRY_RUN) {
          await prisma.university.update({ where: { id: broken.id }, data: { name: group.new_name } });
        }
        stats.renamedOnly += 1;
      }
      continue;
    }

    // Merge every broken row's Programs onto canonical, then deactivate the broken row.
    for (const broken of brokenRows) {
      const brokenPrograms = await prisma.program.findMany({ where: { universityId: broken.id } });
      for (const bp of brokenPrograms) {
        const canonicalProgram = await prisma.program.findUnique({
          where: { universityId_name: { universityId: canonical.id, name: bp.name } },
        });
        const mergedSpecs = canonicalProgram
          ? Array.from(new Set([...(canonicalProgram.specializations ?? []), ...(bp.specializations ?? [])]))
          : bp.specializations;
        report.push({
          action: 'merge-program',
          program: bp.name,
          fromUniversity: broken.name,
          toUniversity: canonical.name,
          specializationsCount: mergedSpecs.length,
        });
        if (!DRY_RUN) {
          await prisma.program.upsert({
            where: { universityId_name: { universityId: canonical.id, name: bp.name } },
            update: { specializations: mergedSpecs, isActive: true },
            create: {
              universityId: canonical.id,
              name: bp.name,
              specializations: mergedSpecs,
              description: canonical.city ?? null,
              isActive: true,
            },
          });
          await prisma.program.update({ where: { id: bp.id }, data: { isActive: false } });
        }
        stats.programsMigrated += 1;
        stats.programsDeactivated += 1;
      }

      const missingLevels = broken.levels.filter((l) => !canonical.levels.includes(l));
      if (missingLevels.length > 0 && !DRY_RUN) {
        await prisma.university.update({
          where: { id: canonical.id },
          data: { levels: { push: missingLevels } },
        });
      }

      report.push({ action: 'deactivate-duplicate', name: broken.name, keptAs: canonical.name });
      if (!DRY_RUN) {
        await prisma.university.update({ where: { id: broken.id }, data: { isActive: false } });
      }
      stats.merged += 1;
    }
  }

  console.log(`Groups processed: ${stats.groupsProcessed}`);
  console.log(`Renamed in place (not a duplicate, just fixed the name): ${stats.renamedOnly}`);
  console.log(`Merged + deactivated as duplicates: ${stats.merged}`);
  console.log(`Programs migrated: ${stats.programsMigrated} (and deactivated on the old row: ${stats.programsDeactivated})`);
  console.log((DRY_RUN ? '\n(dry run -- nothing written)\n' : '\n'));
  console.log('Sample actions (first 40):');
  for (const r of report.slice(0, 40)) console.log(' ', JSON.stringify(r));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
