'use client'

import TradingOperatorModulePage from '@/components/trading/operator/TradingOperatorModulePage'

export default function TradingOperatorDataGovernancePage() {
  return (
    <TradingOperatorModulePage
      title="Data Retention & Legal Hold"
      description="Manage retention policy and legal hold controls for trade records, audit trails, and support artifacts."
      actions={[
        {
          href: '/trading/operator/audit',
          title: 'Audit Trail',
          description: 'Validate retention execution across security and operational events.',
        },
      ]}
    />
  )
}
