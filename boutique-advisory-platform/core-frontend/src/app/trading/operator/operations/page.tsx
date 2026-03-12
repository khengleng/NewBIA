'use client'

import TradingOperatorModulePage from '@/components/trading/operator/TradingOperatorModulePage'

export default function TradingOperatorOperationsPage() {
  return (
    <TradingOperatorModulePage
      title="Market Surveillance"
      description="Operate day-to-day surveillance for price anomalies, abusive order patterns, and listing integrity."
      actions={[
        {
          href: '/trading/markets',
          title: 'Market Monitor',
          description: 'Inspect live listings and activity in the market scanner.',
        },
        {
          href: '/trading/operator/listing-control',
          title: 'Listing Governance',
          description: 'Freeze or retire listings that breach trading policy.',
        },
      ]}
    />
  )
}
