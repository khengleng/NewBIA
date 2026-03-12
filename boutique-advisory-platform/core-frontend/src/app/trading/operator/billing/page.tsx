'use client'

import TradingOperatorModulePage from '@/components/trading/operator/TradingOperatorModulePage'

export default function TradingOperatorBillingPage() {
  return (
    <TradingOperatorModulePage
      title="Billing & Payout Operations"
      description="Handle trading invoices, payout runs, and reconciliation exceptions for the exchange business unit."
      actions={[
        {
          href: '/trading/operator/reconciliation',
          title: 'Open Fee Reconciliation',
          description: 'Track fee accruals, settlement status, and failed payouts.',
        },
      ]}
      note="Billing in trade.cambobia.com is isolated from cambobia.com advisory and SaaS billing flows."
    />
  )
}
