export const PLATFORM_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'FINOPS',
  'CX',
  'AUDITOR',
  'COMPLIANCE',
  'ADVISOR',
  'SUPPORT',
  'INVESTOR',
  'SME',
] as const

export const TRADING_OPERATOR_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'FINOPS',
  'CX',
  'AUDITOR',
  'COMPLIANCE',
  'SUPPORT',
] as const

export function normalizeRole(role: string | null | undefined): string {
  return String(role ?? '').toUpperCase()
}

export function isTradingOperatorRole(role: string | null | undefined): boolean {
  return TRADING_OPERATOR_ROLES.includes(normalizeRole(role) as (typeof TRADING_OPERATOR_ROLES)[number])
}

export function isAdminLikeRole(role: string | null | undefined): boolean {
  return ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'COMPLIANCE', 'AUDITOR', 'CX'].includes(normalizeRole(role))
}

