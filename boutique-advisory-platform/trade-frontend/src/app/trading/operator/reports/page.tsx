'use client'

import TradingOperatorModulePage from '@/components/trading/operator/TradingOperatorModulePage'

export default function TradingOperatorReportsPage() {
  return (
    <TradingOperatorModulePage
      title="Trading Reports Hub"
      description="Generate operational, compliance, and finance reports specifically for trade.cambobia.com governance."
      actions={[
        {
          href: '/trading/operator/reconciliation',
          title: 'Fee Reports',
          description: 'Review revenue and settlement reconciliation outputs.',
        },
        {
          href: '/trading/operator/audit',
          title: 'Audit Reports',
          description: 'Inspect operator actions and sensitive workflow changes.',
        },
      ]}
    />
  )
}
