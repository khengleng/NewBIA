export type AdminRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'FINOPS'
  | 'CX'
  | 'AUDITOR'
  | 'COMPLIANCE'
  | 'ADVISOR'
  | 'INVESTOR'
  | 'SME'
  | 'SUPPORT';
export type UserLifecycleStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DELETED';

export function canModifyAcrossTenant(
  actorRole: AdminRole | string | undefined,
  actorTenantId: string | undefined,
  targetTenantId: string | undefined
): boolean {
  if (actorRole === 'SUPER_ADMIN') return true;
  if (!actorTenantId || !targetTenantId) return false;
  return actorTenantId === targetTenantId;
}

export function isAllowedStatusTransition(
  currentStatus: UserLifecycleStatus | string | undefined,
  nextStatus: UserLifecycleStatus | string | undefined
): boolean {
  if (!currentStatus || !nextStatus) return false;

  // Hard lifecycle rule: deleted accounts cannot be reactivated directly.
  if (currentStatus === 'DELETED' && nextStatus === 'ACTIVE') {
    return false;
  }

  return ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED'].includes(nextStatus);
}
