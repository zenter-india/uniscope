import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPr, classifyFile, dependencyChanges } from './risk-rules.mjs';

test('docs and tests only is LOW', () => {
  const r = classifyPr(['docs/a.md', 'backend/src/modules/wallet/wallet.service.spec.ts', 'mobile_flutter/test/x_test.dart']);
  assert.equal(r.tier, 'LOW');
});

test('sensitive paths are HIGH', () => {
  assert.equal(classifyFile('backend/src/auth/otp/msg91-otp.provider.ts').tier, 'HIGH');
  assert.equal(classifyFile('backend/prisma/migrations/2026_x/migration.sql').tier, 'HIGH');
  assert.equal(classifyFile('mobile_flutter/android/app/build.gradle.kts').tier, 'HIGH');
  assert.equal(classifyFile('mobile_flutter/lib/features/auth/login_screen.dart').tier, 'HIGH');
  assert.equal(classifyFile('backend/.env.example').tier, 'HIGH');
  assert.equal(classifyFile('.github/workflows/ci.yml').tier, 'HIGH');
});

test('ordinary product code is MEDIUM, marketing content LOW', () => {
  assert.equal(classifyFile('admin/app/dashboard/page.tsx').tier, 'MEDIUM');
  assert.equal(classifyFile('backend/src/modules/universities/universities.service.ts').tier, 'MEDIUM');
  assert.equal(classifyFile('web/app/privacy/page.tsx').tier, 'LOW');
  assert.equal(classifyFile('web/lib/api.ts').tier, 'MEDIUM');
});

test('highest tier wins across files', () => {
  const r = classifyPr(['admin/app/page.tsx', 'backend/src/auth/auth.service.ts']);
  assert.equal(r.tier, 'HIGH');
});

test('throttle change makes a MEDIUM file HIGH', () => {
  const f = 'backend/src/modules/enrollments/enrollments.controller.ts';
  const r = classifyPr([f], { [f]: ["  @Throttle({ default: { limit: 10, ttl: 60_000 } })"] }, {});
  assert.equal(r.tier, 'HIGH');
  assert.ok(r.reasons.some((x) => /Rate limiting/.test(x.reason)));
});

test('removing a guard is CRITICAL', () => {
  const f = 'backend/src/modules/universities/universities.controller.ts';
  const r = classifyPr([f], {}, { [f]: ['  @UseGuards(JwtAuthGuard, RolesGuard)'] });
  assert.equal(r.tier, 'CRITICAL');
});

test('destructive migration is CRITICAL, DROP INDEX is not', () => {
  const m = 'backend/prisma/migrations/2026_y/migration.sql';
  assert.equal(classifyPr([m], { [m]: ['DROP TABLE "users";'] }, {}).tier, 'CRITICAL');
  assert.equal(classifyPr([m], { [m]: ['DROP INDEX "x_key";'] }, {}).tier, 'HIGH');
});

test('major dependency bump and SDK change are HIGH, minor is MEDIUM', () => {
  const f = 'backend/package.json';
  const major = dependencyChanges({ [f]: ['    "@nestjs/jwt": "^12.0.3",'] }, { [f]: ['    "@nestjs/jwt": "^11.0.2",'] });
  assert.equal(major[0].major, true);
  assert.equal(classifyPr([f], { [f]: ['    "@nestjs/jwt": "^12.0.3",'] }, { [f]: ['    "@nestjs/jwt": "^11.0.2",'] }).tier, 'HIGH');
  const minor = classifyPr([f], { [f]: ['    "uuid": "^7.1.0",'] }, { [f]: ['    "uuid": "^7.0.3",'] });
  assert.equal(minor.tier, 'MEDIUM');
  const sdk = classifyPr(['mobile_flutter/pubspec.yaml'], { 'mobile_flutter/pubspec.yaml': ['  firebase_core: ^4.15.2'] }, { 'mobile_flutter/pubspec.yaml': ['  firebase_core: ^4.12.1'] });
  assert.equal(sdk.tier, 'HIGH');
});

test('OTP mock provider added is CRITICAL', () => {
  const f = 'backend/railway.toml';
  assert.equal(classifyPr([f], { [f]: ['OTP_PROVIDER_TYPE = "mock"'] }, {}).tier, 'CRITICAL');
});
