import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const rows = await prisma.$queryRawUnsafe(`
  SELECT id, name, state, city FROM universities WHERE stream = 'Medical' AND is_active = true
`);

const norm = (s) => (s ?? '')
  .toString()
  .replace(/&#39;/g, "'")
  .replace(/^\/?deem\s*ed\s*/i, '') // strip corrupted "/Deem ed" prefix
  .replace(/[.,'&()/-]/g, ' ')
  .replace(/\band\b/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const groups = new Map();
for (const r of rows) {
  const key = `${norm(r.name)}|||${norm(r.state)}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

const dupes = [...groups.entries()].filter(([, v]) => v.length > 1);
console.log('Total active Medical universities:', rows.length);
console.log('Distinct normalized keys:', groups.size);
console.log('Groups with >1 row:', dupes.length);
console.log('Total rows involved:', dupes.reduce((a, [, v]) => a + v.length, 0));
console.log('\nAll duplicate groups:');
dupes.forEach(([key, v]) => {
  console.log(`\n  [${v.length}x]`);
  v.forEach(r => console.log(`    "${r.name}" | ${r.state} | ${r.city} | ${r.id}`));
});

await prisma.$disconnect();
