'use client'

import TradingOperatorModulePage from '@/components/trading/operator/TradingOperatorModulePage'

export default function TradingOperatorDealOversightPage() {
  return (
    <TradingOperatorModulePage
      title="Issuer & Listing Compliance"
      description="Oversee tokenized unit eligibility and issuer disclosures before and during exchange listing."
      actions={[
        {
          href: '/trading/operator/listing-control',
          title: 'Listing Governance',
          description: 'Apply operational decisions for active and pending listings.',
        },
      ]}
      note="Only finalized tokenized units from cambobia.com should be admitted to trading on this platform."
    />
  )
}
