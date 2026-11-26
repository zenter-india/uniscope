import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { AdminMoneyController } from './admin-money.controller.js';

/** Money reporting shows every user's top-ups and every mentor's earnings. */
describe('AdminMoneyController', () => {
  it('is only reachable by a signed-in ADMIN', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminMoneyController)).toEqual([
      UserRole.ADMIN,
    ]);
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminMoneyController,
    ) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
  });

  it('lives under /admin/money', () => {
    expect(Reflect.getMetadata('path', AdminMoneyController)).toBe(
      'admin/money',
    );
  });
});
