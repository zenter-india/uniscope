import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';

// TEST_MATRIX.md AUTHZ-002 — a non-admin caller must be blocked from
// admin-only routes (403). RolesGuard is the single enforcement point every
// @Roles(UserRole.ADMIN)-decorated route goes through.
describe('RolesGuard (AUTHZ-002)', () => {
  function contextWithUserRole(role: string | undefined): ExecutionContext {
    return {
      getHandler: () => ({}) as never,
      getClass: () => ({}) as never,
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : undefined }),
      }),
    } as unknown as ExecutionContext;
  }

  function guardWithRequiredRoles(roles: string[] | undefined): RolesGuard {
    const reflector = {
      getAllAndOverride: () => roles,
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  }

  it('blocks a non-admin caller from an ADMIN-only route', () => {
    const guard = guardWithRequiredRoles(['ADMIN']);
    expect(guard.canActivate(contextWithUserRole('ASPIRANT'))).toBe(false);
    expect(guard.canActivate(contextWithUserRole('MENTOR'))).toBe(false);
  });

  it('allows an admin caller through an ADMIN-only route', () => {
    const guard = guardWithRequiredRoles(['ADMIN']);
    expect(guard.canActivate(contextWithUserRole('ADMIN'))).toBe(true);
  });

  it('allows any authenticated caller through an undecorated route', () => {
    const guard = guardWithRequiredRoles(undefined);
    expect(guard.canActivate(contextWithUserRole('ASPIRANT'))).toBe(true);
  });
});
