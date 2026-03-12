'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import PortfolioOverview from '../../../components/PortfolioOverview'
import usePermissions from '../../../hooks/usePermissions'
import { isTradingOperatorRole, normalizeRole } from '../../../lib/roles'

export default function InvestorPortfolioPage() {
    const router = useRouter()
    const { user, isLoading } = usePermissions()

    useEffect(() => {
        if (isLoading) return
        const role = normalizeRole(user?.role)
        if (isTradingOperatorRole(role)) {
            router.replace('/trading/markets')
        }
    }, [isLoading, router, user?.role])

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="text-gray-300">Loading...</div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">My Investment Portfolio</h1>
                    <p className="text-gray-400 mt-1">Track your SME investments, performance, and allocations.</p>
                </div>

                <PortfolioOverview />
            </div>
        </DashboardLayout>
    )
}
