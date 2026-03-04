import test from 'node:test';
import assert from 'node:assert';
import {
  hasPermission,
  canPerformAction,
  createPermissionHelpers,
} from '../lib/permissions';

test('permissions - direct role checks', () => {
  assert.strictEqual(hasPermission('ADMIN', 'settings.read'), true);
  assert.strictEqual(hasPermission('INVESTOR', 'settings.read'), false);
});

test('permissions - owner checks', () => {
  assert.strictEqual(hasPermission('SME', 'sme.update', true), true);
  assert.strictEqual(hasPermission('SME', 'sme.update', false), false);
  assert.strictEqual(hasPermission('INVESTOR', 'investor.update', true), true);
});

test('permissions - unknown permission and missing role are denied', () => {
  assert.strictEqual(hasPermission(undefined, 'sme.list'), false);
  assert.strictEqual(hasPermission('ADMIN', 'not.real.permission'), false);
});

test('permissions - canPerformAction delegates correctly', () => {
  assert.strictEqual(canPerformAction('INVESTOR', 'deal', 'create'), true);
  assert.strictEqual(canPerformAction('INVESTOR', 'deal', 'delete'), false);
});

test('permission helpers - null user gets no elevated permissions', () => {
  const helpers = createPermissionHelpers(null);
  assert.strictEqual(helpers.isAdmin, false);
  assert.strictEqual(helpers.canCreateSME, false);
  assert.strictEqual(helpers.canViewSettings, false);
});

test('permission helpers - admin and super-admin behavior', () => {
  const adminHelpers = createPermissionHelpers({ id: 'a1', role: 'ADMIN' });
  assert.strictEqual(adminHelpers.isAdmin, true);
  assert.strictEqual(adminHelpers.isSuperAdmin, false);
  assert.strictEqual(adminHelpers.canCreateSME, true);
  assert.strictEqual(adminHelpers.canAccessSystemSettings, false);

  const superAdminHelpers = createPermissionHelpers({ id: 'sa1', role: 'SUPER_ADMIN' });
  assert.strictEqual(superAdminHelpers.isAdmin, true);
  assert.strictEqual(superAdminHelpers.isSuperAdmin, true);
  assert.strictEqual(superAdminHelpers.canAccessSystemSettings, true);
});

test('permission helpers - finops is not implicit admin', () => {
  const finopsHelpers = createPermissionHelpers({ id: 'f1', role: 'FINOPS' });
  assert.strictEqual(finopsHelpers.isAdmin, false);
  assert.strictEqual(finopsHelpers.canViewSettings, false);
});
