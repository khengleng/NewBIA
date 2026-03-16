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
  const normalized = String(role ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (!normalized) return ''

  if (normalized.includes('SUPER') && normalized.includes('ADMIN')) return 'SUPER_ADMIN'
  if (normalized === 'SUPERADMIN' || normalized === 'SUPER__ADMIN') return 'SUPER_ADMIN'
  if (normalized === 'SUPER_USER' || normalized === 'SUPERUSER' || normalized === 'ROOT') return 'SUPER_ADMIN'

  if (normalized === 'OPERATOR' || normalized === 'PLATFORM_OPERATOR' || normalized === 'TRADING_OPERATOR') return 'ADMIN'
  if (normalized === 'ADMIN' || normalized.startsWith('ADMIN_') || normalized.endsWith('_ADMIN')) return 'ADMIN'
  if (normalized === 'FIN_OPS' || normalized === 'FINANCE_OPS' || normalized === 'FINANCIAL_OPS') return 'FINOPS'
  if (normalized === 'CUSTOMER_EXPERIENCE' || normalized === 'CUSTOMER_SUCCESS') return 'CX'
  if (normalized === 'CUSTOMER_SUPPORT') return 'CX'
  if (normalized === 'COMPLIANCE_OFFICER') return 'COMPLIANCE'
  // Legal/Sales/Marketing are normalized to existing persisted operator roles.
  if (normalized === 'LEGAL' || normalized === 'LEGAL_OPS' || normalized === 'LEGAL_COUNSEL') return 'COMPLIANCE'
  if (normalized === 'SALES' || normalized === 'SALES_OPS' || normalized === 'BUSINESS_DEVELOPMENT') return 'CX'
  if (normalized === 'MARKETING' || normalized === 'MARKETING_OPS' || normalized === 'GROWTH') return 'CX'
  if (normalized === 'SUPPORT_AGENT') return 'SUPPORT'

  return normalized
}

export function isTradingOperatorRole(role: string | null | undefined): boolean {
  return TRADING_OPERATOR_ROLES.includes(normalizeRole(role) as (typeof TRADING_OPERATOR_ROLES)[number])
}

export function isAdminLikeRole(role: string | null | undefined): boolean {
  return ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'COMPLIANCE', 'AUDITOR', 'CX'].includes(normalizeRole(role))
}
