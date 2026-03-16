'use client'

import TradingOperatorModulePage from '@/components/trading/operator/TradingOperatorModulePage'

export default function TradingOperatorAdvisorOpsPage() {
  return (
    <TradingOperatorModulePage
      title="Liquidity Partner Desk"
      description="Manage advisor/broker participation supporting secondary market liquidity and investor flow."
      actions={[
        {
          href: '/trading/operator/analytics',
          title: 'Flow Analytics',
          description: 'Review conversion and execution metrics by partner channel.',
        },
      ]}
    />
  )
}
