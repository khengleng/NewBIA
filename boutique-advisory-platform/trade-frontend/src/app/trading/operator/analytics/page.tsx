'use client'

import TradingOperatorModulePage from '@/components/trading/operator/TradingOperatorModulePage'

export default function TradingOperatorAnalyticsPage() {
  return (
    <TradingOperatorModulePage
      title="Exchange Analytics"
      description="Analyze demand, liquidity concentration, and conversion funnel performance for the trading platform."
      actions={[
        {
          href: '/trading/operator/dashboard',
          title: 'Control Tower',
          description: 'Return to the real-time operations overview.',
        },
      ]}
    />
  )
}
