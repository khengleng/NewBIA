'use client'

import TradingOperatorModulePage from '@/components/trading/operator/TradingOperatorModulePage'

export default function TradingOperatorOnboardingPage() {
  return (
    <TradingOperatorModulePage
      title="Participant Onboarding"
      description="Coordinate activation workflows for trader accounts entering the exchange from cambobia.com investor onboarding."
      actions={[
        {
          href: '/trading/operator/investor-kyc',
          title: 'eKYC Queue',
          description: 'Review KYC readiness before enabling trading privileges.',
        },
      ]}
    />
  )
}
