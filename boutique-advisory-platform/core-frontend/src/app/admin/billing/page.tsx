'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { authorizedRequest } from '@/lib/api'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Search, Wallet } from 'lucide-react'

interface BillingMetrics {
    monthlyRevenue: number
    monthlyCompletedCount: number
    pendingAmount: number
    pendingCount: number
    processingAmount: number
    processingCount: number
    failedAmountLast30d: number
    failedCountLast30d: number
    refundedAmountLast30d: number
    refundedCountLast30d: number
    successRate: number
}

interface PaymentUser {
    id: string
    email: string
    firstName: string
    lastName: string
}

interface Transaction {
    id: string
    amount: number
    currency: string
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'CANCELLED'
    method: string
    provider: string
    providerTxId?: string
    description?: string
    createdAt: string
    user: PaymentUser
}

interface Invoice {
    userId: string
    month: string
    invoiceNumber: string
    amountDue: number
    status: 'PENDING' | 'ISSUED' | 'SETTLED' | 'DRAFT' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'VOID'
    completedAmount: number
    pendingAmount: number
    refundedAmount: number
    customer: PaymentUser | null
}

const statuses = ['ALL', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED'] as const

type StatusFilter = typeof statuses[number]

const formatMoney = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)

export default function AdminBillingPage() {
    const [metrics, setMetrics] = useState<BillingMetrics | null>(null)
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
    const [isGeneratingInvoices, setIsGeneratingInvoices] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [status, setStatus] = useState<StatusFilter>('ALL')
    const [search, setSearch] = useState('')
    const [invoiceMonth, setInvoiceMonth] = useState(() => new Date().toISOString().slice(0, 7))

    const query = useMemo(() => {
        const params = new URLSearchParams({ limit: '30' })
        if (status !== 'ALL') params.set('status', status)
        if (search.trim()) params.set('search', search.trim())
        return params.toString()
    }, [status, search])

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true)
            setError('')

            const [overviewRes, txRes, invoicesRes] = await Promise.all([
                authorizedRequest('/api/payments/admin/overview'),
                authorizedRequest(`/api/payments/admin/transactions?${query}`),
                authorizedRequest(`/api/operations/invoices?month=${invoiceMonth}`)
            ])

            if (!overviewRes.ok || !txRes.ok || !invoicesRes.ok) {
                setError('Failed to load billing data')
                return
            }

            const overviewJson = await overviewRes.json()
            const txJson = await txRes.json()
            const invoicesJson = await invoicesRes.json()

            setMetrics(overviewJson.metrics)
            setTransactions(txJson.transactions || [])
            setInvoices(invoicesJson.invoices || [])
        } catch {
            setError('Unable to load billing data')
        } finally {
            setIsLoading(false)
        }
    }, [invoiceMonth, query])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleRetry = async (id: string) => {
        setActionLoadingId(id)
        setError('')
        setMessage('')
        try {
            const res = await authorizedRequest(`/api/payments/admin/transactions/${id}/retry`, { method: 'POST' })
            const payload = await res.json().catch(() => null)
            if (!res.ok) {
                setError(payload?.error || 'Failed to retry payment')
                return
            }
            setMessage(payload?.message || 'Payment retried')
            await fetchData()
        } catch {
            setError('Failed to retry payment')
        } finally {
            setActionLoadingId(null)
        }
    }

    const handleRefund = async (id: string) => {
        const reason = window.prompt('Refund reason', 'Manual refund')
        if (reason === null) return

        setActionLoadingId(id)
        setError('')
        setMessage('')
        try {
            const res = await authorizedRequest(`/api/payments/admin/transactions/${id}/refund`, {
                method: 'POST',
                body: JSON.stringify({ reason })
            })
            const payload = await res.json().catch(() => null)
            if (!res.ok) {
                setError(payload?.error || 'Failed to refund payment')
                return
            }
            setMessage(payload?.message || 'Payment refunded')
            await fetchData()
        } catch {
            setError('Failed to refund payment')
        } finally {
            setActionLoadingId(null)
        }
    }

    const handleGenerateInvoices = async () => {
        setIsGeneratingInvoices(true)
        setError('')
        setMessage('')
        try {
            const res = await authorizedRequest('/api/operations/invoices/generate-monthly', {
                method: 'POST',
                body: JSON.stringify({ month: invoiceMonth })
            })
            const payload = await res.json().catch(() => null)
            if (!res.ok) {
                setError(payload?.error || 'Failed to generate invoices')
                return
            }
            setMessage(`Invoices generated: ${payload?.generated ?? 0} for ${payload?.month || invoiceMonth}`)
            await fetchData()
        } catch {
            setError('Failed to generate invoices')
        } finally {
            setIsGeneratingInvoices(false)
        }
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <Wallet className="w-8 h-8 text-blue-400" />
                            Billing Operations
                        </h1>
                        <p className="text-gray-400 mt-1">Revenue, payment queue, retries, and refunds in one admin workflow.</p>
                    </div>
                    <button
                        onClick={fetchData}
                        className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {error}
                    </div>
                )}
                {message && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-400 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        {message}
                    </div>
                )}

                {metrics && (
                    <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
                        <MetricCard label="Monthly Revenue" value={formatMoney(metrics.monthlyRevenue)} />
                        <MetricCard label="Pending Queue" value={`${metrics.pendingCount} (${formatMoney(metrics.pendingAmount)})`} />
                        <MetricCard label="Processing" value={`${metrics.processingCount} (${formatMoney(metrics.processingAmount)})`} />
                        <MetricCard label="Failed (30d)" value={`${metrics.failedCountLast30d} (${formatMoney(metrics.failedAmountLast30d)})`} />
                        <MetricCard label="Success Rate" value={`${metrics.successRate}%`} />
                    </div>
                )}

                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
                    <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
                        <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
                            <Search className="w-4 h-4 text-gray-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search email, tx id, description"
                                className="bg-transparent text-sm text-white outline-none w-72 max-w-full"
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {statuses.map((item) => (
                                <button
                                    key={item}
                                    onClick={() => setStatus(item)}
                                    className={`px-3 py-1.5 rounded-lg border text-xs ${status === item
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-700'
                                        }`}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-400 border-b border-gray-700">
                                        <th className="py-2 pr-3">Date</th>
                                        <th className="py-2 pr-3">Customer</th>
                                        <th className="py-2 pr-3">Amount</th>
                                        <th className="py-2 pr-3">Method</th>
                                        <th className="py-2 pr-3">Status</th>
                                        <th className="py-2 pr-3">Tx ID</th>
                                        <th className="py-2 pr-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((tx) => (
                                        <tr key={tx.id} className="border-b border-gray-800 text-gray-200">
                                            <td className="py-3 pr-3 whitespace-nowrap">{new Date(tx.createdAt).toLocaleString()}</td>
                                            <td className="py-3 pr-3">
                                                <div className="font-medium">{tx.user?.firstName} {tx.user?.lastName}</div>
                                                <div className="text-xs text-gray-400">{tx.user?.email}</div>
                                            </td>
                                            <td className="py-3 pr-3">{formatMoney(tx.amount, tx.currency)}</td>
                                            <td className="py-3 pr-3">{tx.provider} / {tx.method}</td>
                                            <td className="py-3 pr-3">
                                                <StatusBadge status={tx.status} />
                                            </td>
                                            <td className="py-3 pr-3 text-xs text-gray-400">{tx.providerTxId || '-'}</td>
                                            <td className="py-3 pr-3">
                                                <div className="flex justify-end gap-2">
                                                    {(tx.status === 'FAILED' || tx.status === 'CANCELLED') && (
                                                        <button
                                                            onClick={() => handleRetry(tx.id)}
                                                            disabled={actionLoadingId === tx.id}
                                                            className="px-2 py-1 rounded bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 disabled:opacity-50"
                                                        >
                                                            Retry
                                                        </button>
                                                    )}
                                                    {tx.status === 'COMPLETED' && (
                                                        <button
                                                            onClick={() => handleRefund(tx.id)}
                                                            disabled={actionLoadingId === tx.id}
                                                            className="px-2 py-1 rounded bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30 disabled:opacity-50"
                                                        >
                                                            Refund
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {transactions.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="text-center py-10 text-gray-500">No transactions found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-white font-semibold">Invoice Ledger</h2>
                        <div className="flex items-center gap-2">
                            <input
                                type="month"
                                value={invoiceMonth}
                                onChange={(e) => setInvoiceMonth(e.target.value)}
                                className="bg-gray-900 border border-gray-700 text-gray-200 rounded px-2 py-1 text-sm"
                            />
                            <button
                                onClick={handleGenerateInvoices}
                                disabled={isGeneratingInvoices}
                                className="px-3 py-1.5 text-xs rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 disabled:opacity-50"
                            >
                                {isGeneratingInvoices ? 'Generating...' : 'Generate'}
                            </button>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-400 border-b border-gray-700">
                                        <th className="py-2 pr-3">Invoice</th>
                                        <th className="py-2 pr-3">Customer</th>
                                        <th className="py-2 pr-3">Completed</th>
                                        <th className="py-2 pr-3">Refunded</th>
                                        <th className="py-2 pr-3">Pending</th>
                                        <th className="py-2 pr-3">Amount Due</th>
                                        <th className="py-2 pr-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((invoice) => (
                                        <tr key={invoice.invoiceNumber} className="border-b border-gray-800 text-gray-200">
                                            <td className="py-3 pr-3 font-mono text-xs">{invoice.invoiceNumber}</td>
                                            <td className="py-3 pr-3">
                                                <div className="font-medium">{invoice.customer?.firstName} {invoice.customer?.lastName}</div>
                                                <div className="text-xs text-gray-400">{invoice.customer?.email || '-'}</div>
                                            </td>
                                            <td className="py-3 pr-3">{formatMoney(invoice.completedAmount)}</td>
                                            <td className="py-3 pr-3">{formatMoney(invoice.refundedAmount)}</td>
                                            <td className="py-3 pr-3">{formatMoney(invoice.pendingAmount)}</td>
                                            <td className="py-3 pr-3 font-semibold">{formatMoney(invoice.amountDue)}</td>
                                            <td className="py-3 pr-3">
                                                <InvoiceStatusBadge status={invoice.status} />
                                            </td>
                                        </tr>
                                    ))}
                                    {invoices.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="text-center py-10 text-gray-500">No invoices generated for this month.</td>
                                        </tr>
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

function MetricCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="text-lg font-bold text-white">{value}</p>
        </div>
    )
}

function StatusBadge({ status }: { status: Transaction['status'] }) {
    const cls = {
        PENDING: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
        PROCESSING: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        COMPLETED: 'bg-green-500/15 text-green-300 border-green-500/30',
        FAILED: 'bg-red-500/15 text-red-300 border-red-500/30',
        REFUNDED: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
        CANCELLED: 'bg-gray-500/15 text-gray-300 border-gray-500/30'
    }[status]

    return <span className={`px-2 py-0.5 rounded text-xs border ${cls}`}>{status}</span>
}

function InvoiceStatusBadge({ status }: { status: Invoice['status'] }) {
    const cls = {
        DRAFT: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
        PENDING: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
        ISSUED: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        SETTLED: 'bg-green-500/15 text-green-300 border-green-500/30',
        PAID: 'bg-green-500/15 text-green-300 border-green-500/30',
        PARTIALLY_PAID: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
        OVERDUE: 'bg-red-500/15 text-red-300 border-red-500/30',
        VOID: 'bg-gray-500/15 text-gray-300 border-gray-500/30'
    }[status]

    return <span className={`px-2 py-0.5 rounded text-xs border ${cls || 'bg-gray-500/15 text-gray-300 border-gray-500/30'}`}>{status}</span>
}
