'use client'

import TradingOperatorModulePage from '@/components/trading/operator/TradingOperatorModulePage'

export default function TradingOperatorRoleLifecyclePage() {
  return (
    <TradingOperatorModulePage
      title="Trading Access Lifecycle"
      description="Control role onboarding, privilege escalation, and periodic access reviews for exchange operators."
      actions={[
        {
          href: '/trading/operator/users',
          title: 'Operator Directory',
          description: 'Open the operator account registry to review active identities.',
        },
        {
          href: '/trading/operator/security',
          title: 'Security Guardrails',
          description: 'Apply MFA and session controls for privileged users.',
        },
      ]}
      note="Recommended policy: no direct super-admin permissions for day-to-day operations; use break-glass controls with audit trail."
    />
  )
}
