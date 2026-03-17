import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission } from './permissions';

test('billing and invoice permissions are admin-only', () => {
  const adminCtx = { userId: 'u1', userRole: 'ADMIN' as const, tenantId: 't1' };
  const investorCtx = { userId: 'u2', userRole: 'INVESTOR' as const, tenantId: 't1' };

  assert.equal(hasPermission(adminCtx, 'billing.read'), true);
  assert.equal(hasPermission(adminCtx, 'billing.manage'), true);
  assert.equal(hasPermission(adminCtx, 'invoice.read'), true);
  assert.equal(hasPermission(investorCtx, 'billing.read'), false);
  assert.equal(hasPermission(investorCtx, 'invoice.manage'), false);
});

test('support role can run operational support flows only', () => {
  const supportCtx = { userId: 'u3', userRole: 'SUPPORT' as const, tenantId: 't1' };

  assert.equal(hasPermission(supportCtx, 'support_ticket.list'), true);
  assert.equal(hasPermission(supportCtx, 'support_ticket.update'), true);
  assert.equal(hasPermission(supportCtx, 'subscription.read'), true);
  assert.equal(hasPermission(supportCtx, 'subscription.manage'), false);
  assert.equal(hasPermission(supportCtx, 'invoice.manage'), false);
});
