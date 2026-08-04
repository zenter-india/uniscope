/**
 * Bulk-seed medical colleges from the official NMC seat matrix + NIRF ranks.
 *
 * Data provenance (see scripts/data/README.md):
 *   facts  - NMC "MBBS Seat Matrix as on 16.10.2025 (AY 2025-26)", nmc.org.in
 *   ranks  - NIRF India Rankings 2025, Medical, nirfindia.org
 *   images - English Wikipedia lead images, CC/public-domain licences only
 *
 * Writes straight through Prisma rather than the admin REST endpoints: the
 * app has a global 120 req/min throttle, so ~840 creates plus image uploads
 * would spend 15+ minutes being rate-limited for no benefit.
 *
 * Idempotent — keyed on slug, so re-running updates in place instead of
 * duplicating. Images are only re-uploaded when a row has no imageUrl yet,
 * so a re-run is cheap and never clobbers a photo an admin uploaded by hand.
 *
 * Usage:
 *   node scripts/seed-universities.mjs            # facts only
 *   node scripts/seed-universities.mjs --images   # facts + image upload
 *   node scripts/seed-universities.mjs --dry-run
 */
import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'data');
const BUCKET = 'university-images';

const WITH_IMAGES = process.argv.includes('--images');
const DRY_RUN = process.argv.includes('--dry-run');

/** Placeholder rows created while testing the admin CRUD screens. */
const JUNK_NAMES = [
  'Test Medical College QA',
  'Random Engineering College',
  'My Random Engineering College Pune',
];

/**
 * Hand-seeded rows that are the same institution as an NMC entry under a
 * short name. Without this the seed inserts a duplicate: "AIIMS New Delhi"
 * would sit next to "All India Institute of Medical Sciences, New Delhi" in
 * Discover, and the original row — which already carries an uploaded photo
 * and any reviews / saved-college rows pointing at its id — would be
 * orphaned. Keyed existing-name -> official NMC name.
 *
 * Deliberately an explicit list rather than fuzzy matching: there are only a
 * handful, and a wrong automatic merge would silently fuse two real colleges.
 */
const ALIASES = {
  'aiims new delhi': 'All India Institute of Medical Sciences, New Delhi',
  'cmc vellore': 'Christian Medical College, Vellore',
  'jipmer puducherry':
    'Jawaharlal Institute of Postgraduate Medical Education & Research, Puducherry',
};

/** Mirrors slugify() in universities.service.ts so seeded slugs match the
 * shape the API would have produced for the same name. */
function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function uniqueSlug(prisma, name, taken) {
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
 * Wikimedia originals are routinely 3-8 MB, far too heavy for a phone hero
 * image, so images.json carries a `thumbUrl` pointing at Wikimedia's own
 * 1280px rendition. We deliberately do NOT resize locally: `sharp`'s native
 * binding hangs indefinitely on import on some machines (it stalled this
 * repo's seed run for 10 minutes before being traced), and letting Wikimedia
 * do the resizing removes the dependency altogether.
 */
async function fetchImage(entry) {
  const url = entry.thumbUrl || entry.imageUrl;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Uniscope-CollegeDataSeed/1.0 (contact: sri.hari.8101@gmail.com)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  return { buf, contentType };
}

async function main() {
  const colleges = JSON.parse(await readFile(path.join(DATA, 'colleges.json'), 'utf8'));
  let images = {};
  if (WITH_IMAGES) {
    const raw = JSON.parse(await readFile(path.join(DATA, 'images.json'), 'utf8'));
    for (const r of raw) if (r.imageUrl) images[r.name] = r;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const supabase =
    WITH_IMAGES && !DRY_RUN
      ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      : null;

  if (supabase) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error && !/already exists/i.test(error.message)) throw error;
  }

  const existing = await prisma.university.findMany({
    select: { id: true, name: true, slug: true, imageUrl: true },
  });
  const byName = new Map(existing.map((u) => [u.name.toLowerCase().trim(), u]));
  const taken = new Set(existing.map((u) => u.slug));

  // Resolve short-name rows onto their official NMC name so they update in
  // place instead of being duplicated.
  for (const [shortName, officialName] of Object.entries(ALIASES)) {
    const row = byName.get(shortName);
    if (row) byName.set(officialName.toLowerCase().trim(), row);
  }

  const stats = { created: 0, updated: 0, imaged: 0, imageFailed: 0, junkRemoved: 0 };

  // 1. Drop the QA placeholder rows.
  for (const junk of JUNK_NAMES) {
    const row = byName.get(junk.toLowerCase());
    if (!row) continue;
    if (!DRY_RUN) await prisma.university.delete({ where: { id: row.id } });
    taken.delete(row.slug);
    stats.junkRemoved += 1;
    console.log(`  removed placeholder row: ${junk}`);
  }

  // 2. Upsert every college.
  for (const [i, c] of colleges.entries()) {
    const prior = byName.get(c.name.toLowerCase().trim());
    const data = {
      name: c.name,
      state: c.state,
      city: c.city ?? null,
      stream: c.stream,
      nirfRank: c.nirfRank ?? null,
      mbbsSeats: c.mbbsSeats ?? null,
      // NIRF-only institutes have no NMC management column; default them to
      // GOVERNMENT only when NIRF says so is impossible, so leave PRIVATE off
      // and use the NMC value when we have one.
      ...(c.type ? { type: c.type } : {}),
    };

    let row = prior;
    if (prior) {
      if (!DRY_RUN) await prisma.university.update({ where: { id: prior.id }, data });
      stats.updated += 1;
    } else {
      const slug = await uniqueSlug(prisma, c.name, taken);
      if (!DRY_RUN) {
        // NIRF-only institutes have no sourced ownership: NIRF publishes no
        // management column and they are absent from the NMC matrix, so the
        // `type` enum (which is NOT NULL) cannot be filled honestly. They are
        // seeded INACTIVE rather than defaulted to PRIVATE, which would put a
        // wrong "Private" badge on government institutes like PGIMER and
        // NIMHANS. Set the real type in the admin panel to publish them.
        row = await prisma.university.create({
          data: {
            ...data,
            slug,
            type: c.type ?? 'PRIVATE',
            isActive: Boolean(c.type),
          },
        });
      }
      stats.created += 1;
    }

    // 3. Attach a freely-licensed photo, if we found one and the row has none.
    const img = images[c.name];
    if (supabase && img && row && !row.imageUrl) {
      try {
        const { buf, contentType } = await fetchImage(img);
        const ext = contentType.includes('png') ? 'png' : 'jpg';
        const key = `${row.id}/wikimedia.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(key, buf, { contentType, upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key);
        await prisma.university.update({
          where: { id: row.id },
          data: { imageUrl: pub.publicUrl },
        });
        stats.imaged += 1;
      } catch (e) {
        stats.imageFailed += 1;
        console.log(`  image failed for ${c.name}: ${e.message}`);
      }
    }

    if (i % 100 === 0) console.log(`  [${i}/${colleges.length}] ${JSON.stringify(stats)}`);
  }

  console.log('\nseed complete:', stats, DRY_RUN ? '(DRY RUN — nothing written)' : '');
  const total = await prisma.university.count();
  const withImg = await prisma.university.count({ where: { imageUrl: { not: null } } });
  const medical = await prisma.university.count({ where: { stream: 'Medical' } });
  console.log(`db now: ${total} universities | ${medical} medical | ${withImg} with image`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
