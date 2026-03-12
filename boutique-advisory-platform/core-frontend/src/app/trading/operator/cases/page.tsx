'use client'

import TradingOperatorModulePage from '@/components/trading/operator/TradingOperatorModulePage'

export default function TradingOperatorCasesPage() {
  return (
    <TradingOperatorModulePage
      title="Trading Case Management"
      description="Handle settlement disputes, listing complaints, and participant support escalations for the exchange."
      actions={[
        {
          href: '/trading/operator/operations',
          title: 'Market Surveillance',
          description: 'Correlate cases with suspicious market or listing behavior.',
        },
      ]}
      note="Case records here should focus on trading incidents, not cambobia.com advisory support cases."
    />
  )
}
