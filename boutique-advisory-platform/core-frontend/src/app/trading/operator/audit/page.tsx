'use client'

import TradingOperatorModulePage from '@/components/trading/operator/TradingOperatorModulePage'

export default function TradingOperatorAuditPage() {
  return (
    <TradingOperatorModulePage
      title="Trading Audit Trail"
      description="Review immutable records for listing actions, role changes, and operator activities on the exchange platform."
      actions={[
        {
          href: '/trading/operator/security',
          title: 'Security Controls',
          description: 'Open security governance controls for privileged operators.',
        },
      ]}
      note="Audit logs here are scoped to trade.cambobia.com platform operations."
    />
  )
}
