/* eslint-disable @typescript-eslint/no-unsafe-assignment --
 * expect.objectContaining is typed `any` by jest. */
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../database/prisma/prisma.service.js';
import { AdminAccountsService } from './admin-accounts.service.js';

type Row = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  isActive: boolean;
  fullAccess: boolean;
  permissions: string[];
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const row = (over: Partial<Row> = {}): Row => ({
  id: 'a1',
  email: 'priya@uniscope.in',
  passwordHash: 'hash',
  displayName: null,
  isActive: true,
  fullAccess: false,
  permissions: [],
  lastLoginAt: null,
  createdAt: new Date('2026-11-01'),
  updatedAt: new Date('2026-11-01'),
  ...over,
});

function setup(existing: Row | null = null) {
  const adminAccount = {
    findUnique: jest.fn().mockResolvedValue(existing),
    create: jest
      .fn()
      .mockImplementation(({ data }: { data: Partial<Row> }) =>
        Promise.resolve(row(data)),
      ),
    update: jest
      .fn()
      .mockImplementation(({ data }: { data: Partial<Row> }) =>
        Promise.resolve(row({ ...existing, ...data })),
      ),
  };
  const service = new AdminAccountsService({
    adminAccount,
  } as unknown as PrismaService);
  return { service, adminAccount };
}

describe('AdminAccountsService — permissions', () => {
  it('a new admin starts with no access unless boxes are ticked', async () => {
    const { service, adminAccount } = setup();
    const created = await service.create({
      email: 'Priya@Uniscope.in',
      password: 'a-long-password',
    });
    expect(adminAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'priya@uniscope.in',
        fullAccess: false,
        permissions: [],
      }),
    });
    expect(created).toMatchObject({ fullAccess: false, permissions: [] });
  });

  it('saves the ticked permissions, cleaned (edit implies view)', async () => {
    const { service, adminAccount } = setup();
    await service.create({
      email: 'priya@uniscope.in',
      password: 'a-long-password',
      permissions: ['payouts:edit', 'users:view', 'bogus'],
    });
    expect(adminAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        permissions: ['payouts:edit', 'payouts:view', 'users:view'],
      }),
    });
  });

  it('can create a full-access admin', async () => {
    const { service, adminAccount } = setup();
    await service.create({
      email: 'boss@uniscope.in',
      password: 'a-long-password',
      fullAccess: true,
    });
    expect(adminAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ fullAccess: true }),
    });
  });

  it('refuses a duplicate email', async () => {
    const { service } = setup(row());
    await expect(
      service.create({
        email: 'priya@uniscope.in',
        password: 'a-long-password',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates permissions and full access, leaving other fields alone', async () => {
    const { service, adminAccount } = setup(row());
    await service.update('a1', {
      fullAccess: false,
      permissions: ['support:edit'],
    });
    const data = (
      adminAccount.update.mock.calls[0] as [{ data: Record<string, unknown> }]
    )[0].data;
    expect(data).toEqual({
      fullAccess: false,
      permissions: ['support:edit', 'support:view'],
    });
  });

  it('404s when updating an unknown admin', async () => {
    const { service } = setup(null);
    await expect(
      service.update('nope', { permissions: [] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('accessFor', () => {
    it('reports what an admin may do, matching the email case-insensitively', async () => {
      const { service, adminAccount } = setup(
        row({ fullAccess: false, permissions: ['users:view'] }),
      );
      adminAccount.findUnique.mockResolvedValue({
        isActive: true,
        fullAccess: false,
        permissions: ['users:view'],
      });
      await expect(service.accessFor(' Priya@Uniscope.in ')).resolves.toEqual({
        exists: true,
        isActive: true,
        fullAccess: false,
        permissions: ['users:view'],
      });
      expect(adminAccount.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'priya@uniscope.in' } }),
      );
    });

    it('reports an unknown email as not existing, with no access', async () => {
      const { service } = setup(null);
      await expect(service.accessFor('nobody@x.in')).resolves.toEqual({
        exists: false,
        isActive: false,
        fullAccess: false,
        permissions: [],
      });
    });

    it('reports a deactivated admin as inactive', async () => {
      const { service, adminAccount } = setup(null);
      adminAccount.findUnique.mockResolvedValue({
        isActive: false,
        fullAccess: true,
        permissions: [],
      });
      await expect(service.accessFor('a@b.in')).resolves.toMatchObject({
        exists: true,
        isActive: false,
      });
    });
  });
});
