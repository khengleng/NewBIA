'use client'

import { useEffect, useState } from 'react'
import {
    Download,
    Upload,
    History,
    Wallet,
    ArrowUpRight,
    ArrowDownLeft,
    Clock,
    Info,
    RefreshCcw,
    AlertCircle,
    CheckCircle2,
} from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { authorizedRequest } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useSocket } from '@/hooks/useSocket'

interface Transaction {
    id: string
    amount: number
    type: string
    status: string
    description: string
    createdAt: string
    metadata?: any
}

interface WalletData {
    id: string
    balance: number
    frozenBalance: number
    currency: string
    status: string
}

export default function WalletPage() {
    const { addToast } = useToast()
    const { socket, isConnected } = useSocket()
    const [isLoading, setIsLoading] = useState(true)
    const [wallet, setWallet] = useState<WalletData | null>(null)
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false)
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [depositAmount, setDepositAmount] = useState('')
    const [withdrawAmount, setWithdrawAmount] = useState('')
    const [filterType, setFilterType] = useState('ALL')

    const fetchWalletData = async () => {
        try {
            const response = await authorizedRequest('/api/wallet')
            if (response.ok) {
                const data = await response.json()
                setWallet(data.wallet)
                setTransactions(data.transactions)
            }
        } catch (error) {
            console.error('Failed to fetch wallet:', error)
            addToast('error', 'Unable to load wallet data')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchWalletData()
    }, [])

    // Real-time updates for balance/transactions
    useEffect(() => {
        if (!socket) return

        const handleUpdate = (data: any) => {
            if (data.type === 'TRADE_EXECUTED' || data.type === 'DEPOSIT_CONFIRMED' || data.type === 'WALLET_UPDATE') {
                fetchWalletData()
            }
        }

        socket.on('market_update', handleUpdate)
        socket.on('wallet_update', handleUpdate)

        return () => {
            socket.off('market_update', handleUpdate)
            socket.off('wallet_update', handleUpdate)
        }
    }, [socket])

    const handleDeposit = async () => {
        const amount = Number(depositAmount)
        if (!amount || amount <= 0) {
            addToast('error', 'Please enter a valid amount')
            return
        }

        setIsProcessing(true)
        try {
            // For now, we still use the simulated deposit as in the trade frontend
            const response = await authorizedRequest('/api/wallet/deposit', {
                method: 'POST',
                body: JSON.stringify({ amount, simulate: true })
            })

            if (response.ok) {
                addToast('success', 'Deposit successful! Your balance has been updated.')
                setIsDepositModalOpen(false)
                setDepositAmount('')
                fetchWalletData()
            } else {
                const err = await response.json()
                addToast('error', err?.error || 'Deposit failed')
            }
        } catch (error) {
            addToast('error', 'Connection error during deposit')
        } finally {
            setIsProcessing(false)
        }
    }

    const handleWithdraw = async () => {
        const amount = Number(withdrawAmount)
        if (!amount || amount <= 0) {
            addToast('error', 'Please enter a valid amount')
            return
        }

        if (wallet && amount > wallet.balance) {
            addToast('error', 'Insufficient balance')
            return
        }

        setIsProcessing(true)
        try {
            const response = await authorizedRequest('/api/wallet/withdraw', {
                method: 'POST',
                body: JSON.stringify({ amount })
            })

            if (response.ok) {
                addToast('success', 'Withdrawal successful! Your bank transfer is being processed.')
                setIsWithdrawModalOpen(false)
                setWithdrawAmount('')
                fetchWalletData()
            } else {
                const err = await response.json()
                addToast('error', err?.error || 'Withdrawal failed')
            }
        } catch (error) {
            addToast('error', 'Connection error during withdrawal')
        } finally {
            setIsProcessing(false)
        }
    }

    const filteredTransactions = transactions.filter(tx => {
        if (filterType === 'ALL') return true
        if (filterType === 'TRADES') return tx.type.startsWith('TRADE_')
        return tx.type === filterType
    })

    const totalBalance = (wallet?.balance || 0) + (wallet?.frozenBalance || 0)

    return (
        <DashboardLayout>
            <div className="space-y-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <Wallet className="w-8 h-8 text-blue-500" />
                            My Wallet
                        </h1>
                        <p className="text-gray-400 mt-1">Manage your investment funds and track your transactions.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsDepositModalOpen(true)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg hover:shadow-blue-500/20"
                        >
                            <Download className="w-4 h-4" /> Deposit
                        </button>
                        <button
                            onClick={() => setIsWithdrawModalOpen(true)}
                            className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 border border-gray-700 transition-all shadow-lg"
                        >
                            <Upload className="w-4 h-4" /> Withdraw
                        </button>
                    </div>
                </div>

                {/* Balance Cards */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-32 bg-gray-800/50 border border-gray-700 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Total Balance Card */}
                        <div className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-700/50 rounded-2xl p-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                                <Wallet className="w-20 h-20" />
                            </div>
                            <p className="text-blue-300 text-sm font-medium mb-1">Total Estimated Value</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-white">${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <span className="text-blue-300 text-sm">USDT</span>
                            </div>
                            <div className="mt-4 flex items-center gap-2 text-xs text-blue-200/60 bg-blue-500/10 w-fit px-2 py-1 rounded-full border border-blue-500/20">
                                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                {isConnected ? 'Live sync active' : 'Syncing...'}
                            </div>
                        </div>

                        {/* Available Balance */}
                        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-gray-400 text-sm">Available Balance</p>
                                <div className="p-2 bg-green-500/10 rounded-lg">
                                    <ArrowDownLeft className="w-4 h-4 text-green-400" />
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-white">${(wallet?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                <span className="text-gray-500 text-sm">USDT</span>
                            </div>
                            <p className="mt-2 text-[11px] text-gray-500">Funds available for deployment.</p>
                        </div>

                        {/* Frozen Balance */}
                        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-gray-400 text-sm">Escrow / Committed</p>
                                <div className="p-2 bg-yellow-500/10 rounded-lg">
                                    <Clock className="w-4 h-4 text-yellow-400" />
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-white">${(wallet?.frozenBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                <span className="text-gray-500 text-sm">USDT</span>
                            </div>
                            <p className="mt-2 text-[11px] text-gray-500">Locked in pending investments or trades.</p>
                        </div>
                    </div>
                )}

                {/* History Section */}
                <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden shadow-xl">
                    <div className="p-6 border-b border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <History className="w-5 h-5 text-gray-400" />
                                Transaction History
                            </h2>
                        </div>

                        <div className="flex items-center gap-2 bg-gray-900 p-1 rounded-xl border border-gray-700">
                            {[
                                { id: 'ALL', label: 'All' },
                                { id: 'DEPOSIT', label: 'Deposits' },
                                { id: 'TRADES', label: 'Trades' },
                                { id: 'WITHDRAWAL', label: 'Withdraw' }
                            ].map(btn => (
                                <button
                                    key={btn.id}
                                    onClick={() => setFilterType(btn.id)}
                                    className={`px-3 py-1.5 text-xs rounded-lg transition-all ${filterType === btn.id ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-900/50 text-xs text-gray-500 uppercase">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Type</th>
                                    <th className="px-6 py-4 font-semibold">Description</th>
                                    <th className="px-6 py-4 font-semibold">Amount</th>
                                    <th className="px-6 py-4 font-semibold">Status</th>
                                    <th className="px-6 py-4 font-semibold">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700/50">
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-6 py-4 h-14 bg-gray-800/10" />
                                        </tr>
                                    ))
                                ) : filteredTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            <div className="flex flex-col items-center gap-3">
                                                <RefreshCcw className="w-8 h-8 opacity-20" />
                                                <p>No transactions found for this selection.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTransactions.map(tx => {
                                        const isCredit = tx.amount > 0
                                        return (
                                            <tr key={tx.id} className="hover:bg-gray-700/30 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${isCredit ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                            {isCredit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                                                        </div>
                                                        <span className="text-xs font-semibold text-gray-300">
                                                            {tx.type.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm text-white group-hover:text-blue-300 transition-colors">{tx.description}</span>
                                                        {tx.metadata?.tradeId && (
                                                            <span className="text-[10px] text-gray-500">Ref: {tx.metadata.tradeId}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-sm font-bold ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
                                                        {isCredit ? '+' : ''}{tx.amount.toLocaleString()} USDT
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5">
                                                        {tx.status === 'SUCCESS' ? (
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                                        ) : (
                                                            <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
                                                        )}
                                                        <span className={`text-[11px] font-medium ${tx.status === 'SUCCESS' ? 'text-green-500' : 'text-yellow-500'}`}>
                                                            {tx.status}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                                        {new Date(tx.createdAt).toLocaleString()}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Deposit Modal */}
            {isDepositModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isProcessing && setIsDepositModalOpen(false)} />
                    <div className="bg-gray-800 border border-gray-700 w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden transition-all scale-up">
                        <div className="p-6 border-b border-gray-700">
                            <h3 className="text-xl font-bold text-white">Deposit USDT</h3>
                            <p className="text-gray-400 text-sm mt-1">Add funds to your wallet using secure payment methods.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">Amount to Deposit (USDT)</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="text-gray-500">$</span>
                                    </div>
                                    <input
                                        type="number"
                                        autoFocus
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full pl-8 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                                <div className="mt-4 grid grid-cols-4 gap-2">
                                    {[100, 500, 1000, 5000].map(val => (
                                        <button
                                            key={val}
                                            onClick={() => setDepositAmount(String(val))}
                                            className="py-2 text-xs bg-gray-900 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                                        >
                                            +${val}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3">
                                <Info className="w-5 h-5 text-blue-400 shrink-0" />
                                <div className="text-xs text-blue-300 leading-relaxed">
                                    Deposit requests are processed securely. Real funds settlement via ABA PayWay is typically instant.
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-900/50 flex flex-col gap-3">
                            <button
                                onClick={handleDeposit}
                                disabled={isProcessing || !depositAmount}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : 'Deposit funds'}
                            </button>
                            <button
                                onClick={() => setIsDepositModalOpen(false)}
                                disabled={isProcessing}
                                className="w-full bg-transparent hover:bg-gray-700 text-gray-400 py-2 rounded-xl text-sm transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Withdraw Modal */}
            {isWithdrawModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isProcessing && setIsWithdrawModalOpen(false)} />
                    <div className="bg-gray-800 border border-gray-700 w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden transition-all scale-up">
                        <div className="p-6 border-b border-gray-700">
                            <h3 className="text-xl font-bold text-white">Withdraw Funds</h3>
                            <p className="text-gray-400 text-sm mt-1">Transfer funds from your platform wallet to your bank account.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase mb-2">Amount to Withdraw (USDT)</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="text-gray-500">$</span>
                                    </div>
                                    <input
                                        type="number"
                                        autoFocus
                                        value={withdrawAmount}
                                        onChange={(e) => setWithdrawAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full pl-8 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                                <div className="mt-2 flex justify-between items-center text-[10px]">
                                    <span className="text-gray-500">Available: ${(wallet?.balance || 0).toLocaleString()} USDT</span>
                                    <button 
                                        onClick={() => setWithdrawAmount(String(wallet?.balance || 0))}
                                        className="text-blue-400 hover:text-blue-300 font-medium"
                                    >
                                        Withdraw All
                                    </button>
                                </div>
                            </div>

                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex gap-3">
                                <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />
                                <div className="text-xs text-yellow-300 leading-relaxed">
                                    Withdrawals are processed manually via bank transfer. Processing typically takes 1-3 business days.
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-900/50 flex flex-col gap-3">
                            <button
                                onClick={handleWithdraw}
                                disabled={isProcessing || !withdrawAmount || Number(withdrawAmount) > (wallet?.balance || 0)}
                                className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-3 rounded-xl transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : 'Confirm Withdrawal'}
                            </button>
                            <button
                                onClick={() => setIsWithdrawModalOpen(false)}
                                disabled={isProcessing}
                                className="w-full bg-transparent hover:bg-gray-700 text-gray-400 py-2 rounded-xl text-sm transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}
