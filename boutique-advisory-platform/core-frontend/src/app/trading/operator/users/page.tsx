'use client'

import { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { authorizedRequest } from '@/lib/api'

interface OperatorUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  status: string
  tenantId: string
}

const operatorRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'CX', 'AUDITOR', 'COMPLIANCE', 'SUPPORT'])

export default function TradingOperatorUsersPage() {
  const [users, setUsers] = useState<OperatorUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await authorizedRequest('/api/admin/users')
        if (!response.ok) {
          throw new Error('Failed to load operator accounts')
        }
        const payload = await response.json()
        const operatorUsers = Array.isArray(payload?.users)
          ? payload.users.filter((user: OperatorUser) => operatorRoles.has(String(user.role || '').toUpperCase()))
          : []
        setUsers(operatorUsers)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load operator accounts')
      } finally {
        setIsLoading(false)
      }
    }

    void loadUsers()
  }, [])

  const summary = useMemo(() => ({
    total: users.length,
    active: users.filter((user) => user.status === 'ACTIVE').length,
    privileged: users.filter((user) => ['SUPER_ADMIN', 'ADMIN'].includes(user.role)).length,
  }), [users])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h1 className="text-3xl font-bold text-white">Operator Account Management</h1>
          <p className="text-gray-400 mt-2">
            Manage platform-operator accounts for the trading exchange independently from cambobia.com tenant users.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <div className="text-sm text-gray-400">Trade Operator Accounts</div>
            <div className="text-3xl font-bold text-white mt-2">{summary.total}</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <div className="text-sm text-gray-400">Active Operators</div>
            <div className="text-3xl font-bold text-white mt-2">{summary.active}</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <div className="text-sm text-gray-400">Privileged Admin Roles</div>
            <div className="text-3xl font-bold text-white mt-2">{summary.privileged}</div>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Trading Operator Directory</h2>
              <p className="text-gray-400 text-sm mt-1">
                Only exchange operations roles appear here. Investor, SME, and advisor identities stay on cambobia.com.
              </p>
            </div>
          </div>

          {isLoading && <div className="text-gray-300">Loading operator accounts...</div>}
          {error && <div className="text-red-300">{error}</div>}

          {!isLoading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-700">
                    <th className="py-3 pr-4">Name</th>
                    <th className="py-3 pr-4">Email</th>
                    <th className="py-3 pr-4">Role</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3">Tenant</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-gray-500">No operator accounts found for the trading platform.</td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="border-b border-gray-800 text-gray-200">
                        <td className="py-4 pr-4">{user.firstName} {user.lastName}</td>
                        <td className="py-4 pr-4">{user.email}</td>
                        <td className="py-4 pr-4">{user.role}</td>
                        <td className="py-4 pr-4">{user.status}</td>
                        <td className="py-4">{user.tenantId}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
