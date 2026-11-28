/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access --
 * Mocks collaborators and inspects the arguments they were called with. */
import { CSV_BOM } from '../money/money-csv';
import {
  LEFT_AT_TEXT,
  STOPPED_MENTOR_WHERE,
  leftAtOf,
  profileSaved,
  stoppedMentorsCsv,
  toStoppedMentor,
  type StoppedMentorRow,
} from './stopped-mentors';
import { UsersService } from './users.service';

const savedProfile = {
  stream: 'Medical',
  state: 'Kerala',
  city: 'Kochi',
  qualification: 'MBBS',
};

const emptyProfile = {
  stream: null,
  state: null,
  city: null,
  qualification: null,
};

function row(over: Partial<StoppedMentorRow> = {}): StoppedMentorRow {
  return {
    id: 'u1',
    displayName: 'Steady Raven #2798',
    phoneEncrypted: null,
    createdAt: new Date('2026-11-20T10:00:00.000Z'),
    lastActiveAt: new Date('2026-11-21T10:00:00.000Z'),
    profile: {
      realNameEncrypted: null,
      ...savedProfile,
      university: { name: 'Govt Medical College' },
    },
    ...over,
  };
}

describe('which mentors count', () => {
  it('is mentors with verification still Draft, leaving out erased accounts', () => {
    expect(STOPPED_MENTOR_WHERE).toEqual({
      role: 'MENTOR',
      verificationStatus: 'DRAFT',
      deletedAt: null,
    });
  });
});

describe('where a mentor stopped', () => {
  it('says the profile was saved only when all four wizard answers are there', () => {
    expect(profileSaved(savedProfile)).toBe(true);
    expect(profileSaved(emptyProfile)).toBe(false);
    expect(profileSaved(null)).toBe(false);
    for (const missing of ['stream', 'state', 'city', 'qualification']) {
      expect(profileSaved({ ...savedProfile, [missing]: null })).toBe(false);
    }
  });

  it('is steps 1 to 4 until the profile is saved, then step 5 or 6', () => {
    expect(leftAtOf(null)).toBe('profile');
    expect(leftAtOf(emptyProfile)).toBe('profile');
    expect(leftAtOf({ ...savedProfile, city: null })).toBe('profile');
    expect(leftAtOf(savedProfile)).toBe('verification');
  });

  it('has plain words for both places', () => {
    expect(LEFT_AT_TEXT.profile.short).toBe('Steps 1 to 4 (profile not saved)');
    expect(LEFT_AT_TEXT.verification.short).toBe(
      'Step 5 or 6 (profile saved, college ID not submitted)',
    );
  });
});

describe('one row of the list', () => {
  it('carries the college, degree, dates and where they stopped', () => {
    const out = toStoppedMentor(row(), {
      realName: 'Ravi Kumar',
      phone: '+919876543210',
      fromWebsite: false,
    });
    expect(out).toMatchObject({
      id: 'u1',
      displayName: 'Steady Raven #2798',
      realName: 'Ravi Kumar',
      phone: '+919876543210',
      college: 'Govt Medical College',
      degree: 'MBBS',
      stream: 'Medical',
      source: 'app',
      leftAt: 'verification',
    });
    expect(out.createdAt).toEqual(new Date('2026-11-20T10:00:00.000Z'));
  });

  it('copes with a mentor who has no profile at all', () => {
    const out = toStoppedMentor(row({ profile: null }), {
      realName: null,
      phone: null,
      fromWebsite: true,
    });
    expect(out).toMatchObject({
      college: null,
      degree: null,
      stream: null,
      source: 'website',
      leftAt: 'profile',
    });
  });
});

describe('the CSV', () => {
  const rows = [
    toStoppedMentor(row(), {
      realName: 'Ravi Kumar',
      phone: '+919876543210',
      fromWebsite: true,
    }),
    toStoppedMentor(row({ id: 'u2', displayName: '=SUM(A1)', profile: null }), {
      realName: null,
      phone: null,
      fromWebsite: false,
    }),
  ];

  it('starts with the headers an admin would read, and says where each stopped', () => {
    const lines = stoppedMentorsCsv(rows).split('\n');
    expect(lines[0].replace(CSV_BOM, '')).toBe(
      '"Signed up","Last active","Name","Alias","Phone","Signed up from","Left at","College","Degree","Stream"',
    );
    expect(lines[1]).toContain('"Ravi Kumar"');
    expect(lines[1]).toContain('"+919876543210"');
    expect(lines[1]).toContain('"Website"');
    expect(lines[1]).toContain(
      '"Step 5 or 6 (profile saved, college ID not submitted)"',
    );
    expect(lines[2]).toContain('"App"');
    expect(lines[2]).toContain('"Steps 1 to 4 (profile not saved)"');
  });

  it('keeps a crafted alias from running as a spreadsheet formula', () => {
    expect(stoppedMentorsCsv(rows)).toContain(`"'=SUM(A1)"`);
  });

  it('writes a phone number as it is, so it can be copied and dialled', () => {
    const line = stoppedMentorsCsv(rows).split('\n')[1];
    expect(line).toContain('"+919876543210"');
    expect(line).not.toContain("'+9198");
  });

  it('still guards anything else that starts with a plus', () => {
    const odd = toStoppedMentor(row({ id: 'u3' }), {
      realName: null,
      phone: '+1+2',
      fromWebsite: false,
    });
    expect(stoppedMentorsCsv([odd])).toContain(`"'+1+2"`);
  });

  it('is just the headers when nobody is on the list', () => {
    expect(stoppedMentorsCsv([]).split('\n')).toHaveLength(1);
  });
});

describe('UsersService stopped mentors', () => {
  function setup(opts: {
    rows?: StoppedMentorRow[];
    total?: number;
    leads?: { convertedUserId: string | null; phone: string }[];
  }) {
    const findMany = jest.fn().mockResolvedValue(opts.rows ?? []);
    const count = jest.fn().mockResolvedValue(opts.total ?? 0);
    const leadFindMany = jest.fn().mockResolvedValue(opts.leads ?? []);
    const svc = Object.assign(Object.create(UsersService.prototype), {
      prisma: {
        user: { findMany, count },
        enrollmentLead: { findMany: leadFindMany },
      },
    }) as UsersService;
    return { svc, findMany, count, leadFindMany };
  }

  it('lists newest first from the shared rule, with the whole count', async () => {
    const { svc, findMany, count } = setup({ rows: [row()], total: 110 });

    const res = await svc.findStoppedMentors({});

    const arg = findMany.mock.calls[0][0];
    expect(arg.where).toBe(STOPPED_MENTOR_WHERE);
    expect(arg.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(arg.take).toBe(101);
    expect(count.mock.calls[0][0].where).toBe(STOPPED_MENTOR_WHERE);
    expect(res.total).toBe(110);
    expect(res.nextCursor).toBeNull();
    expect(res.data).toHaveLength(1);
  });

  it('hands back a cursor when there is more, and continues from one', async () => {
    const three = [row({ id: 'a' }), row({ id: 'b' }), row({ id: 'c' })];
    const { svc, findMany } = setup({ rows: three, total: 3 });

    const res = await svc.findStoppedMentors({ limit: 2 });

    expect(res.data.map((d) => d.id)).toEqual(['a', 'b']);
    expect(res.nextCursor).toBe('b');

    await svc.findStoppedMentors({ limit: 2, cursor: 'b' });
    const arg = findMany.mock.calls[1][0];
    expect(arg.cursor).toEqual({ id: 'b' });
    expect(arg.skip).toBe(1);
  });

  it('never asks for more than 200 at once', async () => {
    const { svc, findMany } = setup({});
    await svc.findStoppedMentors({ limit: 9999 });
    expect(findMany.mock.calls[0][0].take).toBe(201);
  });

  it('marks website sign-ups and falls back to the number typed on the form', async () => {
    const { svc, leadFindMany } = setup({
      rows: [row({ id: 'web' }), row({ id: 'app' })],
      total: 2,
      leads: [{ convertedUserId: 'web', phone: '+919000000001' }],
    });

    const res = await svc.findStoppedMentors({});

    expect(leadFindMany.mock.calls[0][0].where).toEqual({
      convertedUserId: { in: ['web', 'app'] },
    });
    const web = res.data.find((d) => d.id === 'web');
    const app = res.data.find((d) => d.id === 'app');
    expect(web).toMatchObject({ source: 'website', phone: '+919000000001' });
    expect(app).toMatchObject({ source: 'app', phone: null });
  });

  it('does not look up leads for an empty page', async () => {
    const { svc, leadFindMany } = setup({});
    const res = await svc.findStoppedMentors({});
    expect(res.data).toEqual([]);
    expect(leadFindMany).not.toHaveBeenCalled();
  });

  it('exports every one, not just a page', async () => {
    const { svc, findMany } = setup({ rows: [row(), row({ id: 'u2' })] });

    const csv = await svc.exportStoppedMentorsCsv();

    expect(findMany.mock.calls[0][0]).not.toHaveProperty('take');
    expect(findMany.mock.calls[0][0].where).toBe(STOPPED_MENTOR_WHERE);
    expect(csv.split('\n')).toHaveLength(3);
  });
});
