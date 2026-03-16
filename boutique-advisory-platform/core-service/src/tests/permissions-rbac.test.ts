import test from 'node:test';
import assert from 'node:assert';
import {
  hasPermission,
  getPermissionsForRole,
  checkPermissionDetailed,
  canPerformAction,
  type PermissionContext,
} from '../lib/permissions';

test('RBAC - direct role permission is granted', () => {
  const ctx: PermissionContext = {
    userId: 'admin-1',
    userRole: 'ADMIN',
    tenantId: 'tenant-a',
  };

  assert.strictEqual(hasPermission(ctx, 'admin.user_manage'), true);
});

test('RBAC - inherited role permission is granted', () => {
  const ctx: PermissionContext = {
    userId: 'admin-1',
    userRole: 'ADMIN',
    tenantId: 'tenant-a',
  };

  // ADMIN inherits ADVISOR permissions.
  assert.strictEqual(hasPermission(ctx, 'advisory_service.create'), true);
});

test('RBAC - FINOPS does not inherit ADMIN permissions', () => {
  const ctx: PermissionContext = {
    userId: 'finops-1',
    userRole: 'FINOPS',
    tenantId: 'tenant-a',
  };

  assert.strictEqual(hasPermission(ctx, 'admin.user_manage'), false);
});

test('RBAC - owner-only permission requires matching owner', () => {
  const ownerCtx: PermissionContext = {
    userId: 'investor-1',
    userRole: 'INVESTOR',
    tenantId: 'tenant-a',
    resourceOwnerId: 'investor-1',
  };
  const nonOwnerCtx: PermissionContext = {
    userId: 'investor-2',
    userRole: 'INVESTOR',
    tenantId: 'tenant-a',
    resourceOwnerId: 'investor-1',
  };

  assert.strictEqual(hasPermission(ownerCtx, 'investor.read'), true);
  assert.strictEqual(hasPermission(nonOwnerCtx, 'investor.read'), false);
});

test('RBAC - unknown permission is denied', () => {
  const ctx: PermissionContext = {
    userId: 'user-1',
    userRole: 'SME',
    tenantId: 'tenant-a',
  };

  assert.strictEqual(hasPermission(ctx, 'unknown.permission'), false);
});

test('RBAC - permissions list includes inherited permissions', () => {
  const adminPermissions = getPermissionsForRole('ADMIN');
  assert.ok(adminPermissions.includes('advisory_service.create'));
});

test('RBAC - detailed check reports owner reason for owner-only access', () => {
  const ctx: PermissionContext = {
    userId: 'sme-1',
    userRole: 'SME',
    tenantId: 'tenant-a',
    resourceOwnerId: 'sme-1',
  };

  const result = checkPermissionDetailed(ctx, 'sme.read');
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.reason, 'owner');
});

test('RBAC - canPerformAction respects owner flag and user identity', () => {
  assert.strictEqual(
    canPerformAction('SME', 'sme', 'read', true, 'sme-1'),
    true
  );
  assert.strictEqual(
    canPerformAction('SME', 'sme', 'read', false, 'sme-1'),
    false
  );
});
