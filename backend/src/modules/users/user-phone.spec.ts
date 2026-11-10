/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument --
 * This spec inspects the arguments a jest mock was called with (Prisma
 * where/orderBy trees). jest types those as `any`; typing every nested level
 * would only restate the shape the assertions already check. */
import {
  decryptField,
  encryptField,
} from '../../common/helpers/profile-encryption.helper';
import { toAdminUserDetail, toPublicUser } from './user-response';
import { UsersService } from './users.service';

const KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

beforeAll(() => {
  process.env.PROFILE_ENCRYPTION_KEY = KEY;
});

function serviceWith(prisma: Record<string, unknown>) {
  const logger = { warn: jest.fn() };
  // The real constructor needs a pile of unrelated collaborators.
  const svc = Object.assign(Object.create(UsersService.prototype), {
    prisma,
    logger,
  }) as UsersService;
  return { svc, logger };
}

describe('UsersService.rememberPhone', () => {
  it('stores the number encrypted, and only while the column is empty', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const { svc } = serviceWith({ user: { updateMany } });

    await svc.rememberPhone('u1', '+919876543210');

    const arg = updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 'u1', phoneEncrypted: null });
    expect(arg.data.phoneEncrypted).not.toContain('9876543210');
    expect(decryptField(arg.data.phoneEncrypted)).toBe('+919876543210');
  });

  it('never throws — a login must not fail because storing the number did', async () => {
    const updateMany = jest.fn().mockRejectedValue(new Error('db down'));
    const { svc, logger } = serviceWith({ user: { updateMany } });

    await expect(
      svc.rememberPhone('u1', '+919876543210'),
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});

const baseUser = {
  id: 'u1',
  displayName: 'Steady Raven #1',
  uniqueId: null,
  role: 'ASPIRANT',
  verificationStatus: 'DRAFT',
  isActive: true,
  isBanned: false,
  lastActiveAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  profile: null,
  wallet: null,
  verificationRequests: [],
};

describe('toAdminUserDetail — mobile number', () => {
  const detail = (user: Record<string, unknown>, leadPhone?: string | null) =>
    toAdminUserDetail(
      { ...baseUser, ...user } as never,
      {} as never,
      null,
      leadPhone,
    );

  it('shows the decrypted number stored at login', () => {
    const phone = detail({
      phoneEncrypted: encryptField('+919876543210'),
    }).phone;
    expect(phone).toBe('+919876543210');
  });

  it('prefers the stored number over the website-form number', () => {
    const phone = detail(
      { phoneEncrypted: encryptField('+919876543210') },
      '8888888888',
    ).phone;
    expect(phone).toBe('+919876543210');
  });

  it('falls back to the website-form number until the user logs in', () => {
    expect(detail({ phoneEncrypted: null }, '8888888888').phone).toBe(
      '8888888888',
    );
  });

  it('is null when neither exists, or the stored value cannot be decrypted', () => {
    expect(detail({ phoneEncrypted: null }).phone).toBeNull();
    expect(detail({ phoneEncrypted: 'not:valid:payload' }).phone).toBeNull();
  });
});

describe('public user projection', () => {
  it('never carries the phone', () => {
    const json = JSON.stringify(
      toPublicUser({
        ...baseUser,
        phoneHash: 'hash',
        phoneEncrypted: encryptField('+919876543210'),
      } as never),
    );
    expect(json).not.toContain('phone');
    expect(json).not.toContain('9876543210');
  });
});
