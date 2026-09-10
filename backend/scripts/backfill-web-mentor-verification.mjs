/**
 * Backfill VerificationRequest rows for web-registered mentors whose college
 * ID upload never reached the admin queue.
 *
 * Context: before `EnrollmentsService.createMentorLead` resolved a
 * free-typed college name to a real `University` row, a mentor who typed
 * their college (instead of picking it from the dropdown) got:
 *   - a live MENTOR account,
 *   - their uploaded document stored on the `EnrollmentLead` row,
 *   - but NO `VerificationRequest` (its `universityId` is required and was
 *     null), so nothing showed up under admin → Verification.
 *
 * This finds every converted mentor lead with a stored document but no
 * VerificationRequest, resolves the college (lead.universityId, else
 * find-or-create by name+state — created `isActive: false`, same as the
 * live path now does), and creates the missing SUBMITTED request +
 * links profile.universityId + flips verificationStatus → SUBMITTED.
 *
 * Usage (from backend/):
 *   node scripts/backfill-web-mentor-verification.mjs           # dry run
 *   node scripts/backfill-web-mentor-verification.mjs --apply    # write
 *
 * Idempotent: re-running skips any lead whose user now has a request.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'college';

async function uniqueSlug(name) {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const clash = await prisma.university.findUnique({ where: { slug } });
    if (!clash) return slug;
    slug = `${base}-${i}`;
  }
}

async function resolveUniversity(lead) {
  if (lead.universityId) {
    const u = await prisma.university.findUnique({ where: { id: lead.universityId } });
    if (u) return u;
  }
  const name = (lead.collegeName ?? '').trim();
  const state = (lead.state ?? '').trim();
  if (!name || !state) return null; // can't safely place it — leave for a human
  const existing = await prisma.university.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      state: { equals: state, mode: 'insensitive' },
    },
  });
  if (existing) return existing;
  if (!APPLY) return { id: '(would create)', name, state, isActive: false, __new: true };
  return prisma.university.create({
    data: {
      name,
      slug: await uniqueSlug(name),
      state,
      city: (lead.city ?? '').trim() || state,
      stream: lead.stream ?? undefined,
      isActive: false,
    },
  });
}

async function run() {
  const leads = await prisma.enrollmentLead.findMany({
    where: {
      role: 'MENTOR',
      documentKey: { not: null },
      documentType: { not: null },
      convertedUserId: { not: null },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`${leads.length} converted mentor leads with a stored document.\n`);

  let backfilled = 0;
  let skippedHasRequest = 0;
  let skippedState = 0;
  let skippedUnresolvable = 0;

  for (const lead of leads) {
    const user = await prisma.user.findUnique({
      where: { id: lead.convertedUserId },
      include: { profile: true },
    });
    if (!user || user.role !== 'MENTOR') continue;

    if (user.verificationStatus === 'VERIFIED' || user.verificationStatus === 'SUSPENDED') {
      skippedState++;
      continue;
    }
    const existingReq = await prisma.verificationRequest.count({ where: { userId: user.id } });
    if (existingReq > 0) {
      skippedHasRequest++;
      continue;
    }

    const uni = await resolveUniversity(lead);
    if (!uni) {
      skippedUnresolvable++;
      console.log(`  SKIP (no name/state to place)  lead=${lead.id.slice(0, 8)} "${lead.collegeName ?? ''}"`);
      continue;
    }

    console.log(
      `  ${APPLY ? 'BACKFILL' : 'WOULD BACKFILL'}  user=${user.id.slice(0, 8)} ` +
        `"${lead.collegeName ?? ''}" → uni=${uni.id === '(would create)' ? 'NEW' : uni.id.slice(0, 8)}` +
        `${uni.__new ? ' (create inactive)' : ''}  doc=${lead.documentType}`,
    );

    if (APPLY) {
      await prisma.$transaction([
        prisma.verificationRequest.create({
          data: {
            userId: user.id,
            universityId: uni.id,
            documentType: lead.documentType,
            documentKey: lead.documentKey,
            status: 'SUBMITTED',
            submittedAt: new Date(),
          },
        }),
        prisma.user.update({
          where: { id: user.id },
          data: { verificationStatus: 'SUBMITTED' },
        }),
        ...(user.profile && !user.profile.universityId
          ? [
              prisma.userProfile.update({
                where: { userId: user.id },
                data: { universityId: uni.id },
              }),
            ]
          : []),
      ]);
    }
    backfilled++;
  }

  console.log(
    `\n${APPLY ? 'Backfilled' : 'Would backfill'}: ${backfilled}` +
      `\nSkipped (already has a request): ${skippedHasRequest}` +
      `\nSkipped (already verified/suspended): ${skippedState}` +
      `\nSkipped (no name/state to place — needs a human): ${skippedUnresolvable}`,
  );
  if (!APPLY) console.log('\nDry run. Re-run with --apply to write.');
  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
