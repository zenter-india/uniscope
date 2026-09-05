import 'dotenv/config';
import { createHash } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '@prisma/client';

// Prisma 7 requires a driver adapter (matches PrismaService in src/).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type UniversitySeed = {
  name: string;
  slug: string;
  state: string;
  city: string;
  establishedYear?: number;
};

const UNIVERSITIES: UniversitySeed[] = [
  { name: 'All India Institute of Medical Sciences, Delhi', slug: 'aiims-delhi', state: 'Delhi', city: 'New Delhi', establishedYear: 1956 },
  { name: 'Postgraduate Institute of Medical Education and Research', slug: 'pgimer-chandigarh', state: 'Chandigarh', city: 'Chandigarh', establishedYear: 1962 },
  { name: 'Christian Medical College, Vellore', slug: 'cmc-vellore', state: 'Tamil Nadu', city: 'Vellore', establishedYear: 1900 },
  { name: 'National Institute of Mental Health and Neurosciences', slug: 'nimhans-bengaluru', state: 'Karnataka', city: 'Bengaluru', establishedYear: 1974 },
  { name: 'Jawaharlal Institute of Postgraduate Medical Education', slug: 'jipmer-puducherry', state: 'Puducherry', city: 'Puducherry', establishedYear: 1956 },
  { name: 'Sanjay Gandhi Postgraduate Institute of Medical Sciences', slug: 'sgpgims-lucknow', state: 'Uttar Pradesh', city: 'Lucknow', establishedYear: 1983 },
  { name: 'Banaras Hindu University, Institute of Medical Sciences', slug: 'bhu-ims-varanasi', state: 'Uttar Pradesh', city: 'Varanasi', establishedYear: 1960 },
  { name: 'Kasturba Medical College, Manipal', slug: 'kmc-manipal', state: 'Karnataka', city: 'Manipal', establishedYear: 1953 },
  { name: 'Madras Medical College', slug: 'mmc-chennai', state: 'Tamil Nadu', city: 'Chennai', establishedYear: 1835 },
  { name: 'King George Medical University', slug: 'kgmu-lucknow', state: 'Uttar Pradesh', city: 'Lucknow', establishedYear: 1905 },
];

const ADMIN_PHONE = '+919999999999';

function hashPhone(phone: string): string {
  return createHash('sha256').update(phone).digest('hex');
}

async function main() {
  console.log('Seeding universities...');
  for (const u of UNIVERSITIES) {
    await prisma.university.upsert({
      where: { slug: u.slug },
      update: u,
      create: u,
    });
  }
  console.log(`  ${UNIVERSITIES.length} universities upserted.`);

  console.log('Seeding admin user...');
  await prisma.user.upsert({
    where: { phoneHash: hashPhone(ADMIN_PHONE) },
    update: { role: UserRole.ADMIN },
    create: {
      phoneHash: hashPhone(ADMIN_PHONE),
      displayName: 'Platform Admin',
      role: UserRole.ADMIN,
      profile: { create: {} },
    },
  });
  console.log(`  Admin user ready (phone ${ADMIN_PHONE}).`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Seed complete.');
  })
  .catch(async (e) => {
    console.error('Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
