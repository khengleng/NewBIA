'use client'

import TradingOperatorModulePage from '@/components/trading/operator/TradingOperatorModulePage'

export default function TradingOperatorInvestorKycPage() {
  return (
    <TradingOperatorModulePage
      title="Investor eKYC Operations"
      description="Review and govern KYC status for investors who are eligible to trade tokenized units on trade.cambobia.com."
      actions={[
        {
          href: '/trading/operator/onboarding',
          title: 'Onboarding Controls',
          description: 'Open onboarding orchestration for pending trader activation.',
        },
      ]}
      note="KYC in this module is for trading eligibility decisions and audit traceability."
    />
  )
}
