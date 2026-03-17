import test from 'node:test';
import assert from 'node:assert';
import { canModifyAcrossTenant, isAllowedStatusTransition } from '../utils/admin-guards';

test('Tenant isolation - only SUPER_ADMIN can modify across tenants', () => {
  assert.strictEqual(canModifyAcrossTenant('SUPER_ADMIN', 'tenant-a', 'tenant-b'), true);
  assert.strictEqual(canModifyAcrossTenant('ADMIN', 'tenant-a', 'tenant-b'), false);
  assert.strictEqual(canModifyAcrossTenant('ADMIN', 'tenant-a', 'tenant-a'), true);
  assert.strictEqual(canModifyAcrossTenant('ADMIN', undefined, 'tenant-a'), false);
});

test('User lifecycle - deleted users cannot be reactivated directly', () => {
  assert.strictEqual(isAllowedStatusTransition('DELETED', 'ACTIVE'), false);
  assert.strictEqual(isAllowedStatusTransition('DELETED', 'DELETED'), true);
  assert.strictEqual(isAllowedStatusTransition('ACTIVE', 'SUSPENDED'), true);
  assert.strictEqual(isAllowedStatusTransition('SUSPENDED', 'ACTIVE'), true);
});
