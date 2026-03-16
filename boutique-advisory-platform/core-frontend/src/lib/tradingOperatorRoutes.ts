const ADMIN_TO_TRADING_OPERATOR_PREFIX: Array<{ from: string; to: string }> = [
  { from: '/admin/dashboard', to: '/trading/operator/dashboard' },
  { from: '/admin/trading-ops', to: '/trading/operator/listing-control' },
  { from: '/admin/role-lifecycle', to: '/trading/operator/role-lifecycle' },
  { from: '/admin/users', to: '/trading/operator/users' },
  { from: '/admin/reconciliation', to: '/trading/operator/reconciliation' },
  { from: '/admin/billing', to: '/trading/operator/billing' },
  { from: '/admin/business-ops', to: '/trading/operator/business-ops' },
  { from: '/admin/cases', to: '/trading/operator/cases' },
  { from: '/admin/operations', to: '/trading/operator/operations' },
  { from: '/admin/onboarding', to: '/trading/operator/onboarding' },
  { from: '/admin/investor-ops', to: '/trading/operator/investor-kyc' },
  { from: '/admin/deal-ops', to: '/trading/operator/deal-oversight' },
  { from: '/admin/data-governance', to: '/trading/operator/data-governance' },
  { from: '/admin/advisor-ops', to: '/trading/operator/advisor-ops' },
  { from: '/admin/audit', to: '/trading/operator/audit' },
  { from: '/admin/disputes', to: '/trading/operator/cases' },
  { from: '/admin/settings', to: '/trading/operator/security' },
  { from: '/admin/bot', to: '/trading/operator/operations' },
];

const LEGACY_TRADING_PREFIX_REDIRECTS: Array<{ from: string; to: string }> = [
  { from: '/dashboard', to: '/secondary-trading' },
  { from: '/investor/portfolio', to: '/trading/portfolio' },
  { from: '/settings/sessions', to: '/trading/sessions' },
  { from: '/reports', to: '/trading/operator/reports' },
  { from: '/analytics', to: '/trading/operator/analytics' },
  { from: '/notifications', to: '/trading/notifications' },
  { from: '/wallet', to: '/trading/wallet' },
];

function mapByPrefix(
  pathname: string,
  mappings: Array<{ from: string; to: string }>
): string | null {
  for (const mapping of mappings) {
    if (pathname === mapping.from || pathname.startsWith(`${mapping.from}/`)) {
      const suffix = pathname.slice(mapping.from.length);
      return `${mapping.to}${suffix}`;
    }
  }
  return null;
}

export const TRADING_OPERATOR_HOME = '/trading/operator/dashboard';

export function mapAdminPathToTradingOperator(pathname: string): string | null {
  if (pathname === '/admin') return TRADING_OPERATOR_HOME;
  return mapByPrefix(pathname, ADMIN_TO_TRADING_OPERATOR_PREFIX);
}

export function mapLegacyTradingPath(pathname: string): string | null {
  return mapByPrefix(pathname, LEGACY_TRADING_PREFIX_REDIRECTS);
}
