'use client'

import { useState, useEffect } from 'react'
import { PieChart, TrendingUp, TrendingDown, DollarSign, Briefcase, ChevronRight, ArrowUpRight, ShieldCheck, AlertCircle } from 'lucide-react'
import { authorizedRequest } from '../lib/api'
import SumsubKyc from './SumsubKyc'
import { useToast } from '../contexts/ToastContext'
import FileDisputeModal from './FileDisputeModal'
import SellPositionModal from './SellPositionModal'
import { ShieldAlert } from 'lucide-react'

interface PortfolioSummary {
    totalAum: number
    activePositions: number
    realizedRoi: number
    totalPerformance: number
    startDate: string
    kycStatus?: string
}

interface SectorAllocation {
    sector: string
    allocation: number
    value: number
    color: string
}

interface PortfolioItem {
    id: string
    parentId: string
    investmentId?: string
    type: 'DEAL' | 'SYNDICATE' | 'LAUNCHPAD'
    name: string
    sector: string
    allocation: number
    value: number
    shares: number
    returns: number
    color: string
}

export default function PortfolioOverview() {
    const { addToast } = useToast()
    const [showSumsub, setShowSumsub] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [summary, setSummary] = useState<PortfolioSummary>({
        totalAum: 0,
        activePositions: 0,
        realizedRoi: 0,
        totalPerformance: 0,
        startDate: ''
    })
    const [sectors, setSectors] = useState<SectorAllocation[]>([])
    const [items, setItems] = useState<PortfolioItem[]>([])
    const [showDisputeModal, setShowDisputeModal] = useState(false)
    const [selectedDeal, setSelectedDeal] = useState<{ id: string; name: string } | null>(null)
    const [showSellModal, setShowSellModal] = useState(false)
    const [selectedSellItem, setSelectedSellItem] = useState<PortfolioItem | null>(null)
    const [accessDenied, setAccessDenied] = useState(false)

    useEffect(() => {
        fetchPortfolioData()
    }, [])

    const fetchPortfolioData = async () => {
        try {
            const response = await authorizedRequest('/api/investors/portfolio/stats')
            if (response.ok) {
                const data = await response.json()
                setSummary(data.summary)
                setSectors(data.sectors)
                setItems(data.items)
                setAccessDenied(false)
            } else {
                if (response.status === 404 || response.status === 403) {
                    setAccessDenied(true)
                } else {
                    console.error('Failed to fetch portfolio data')
                }
            }
        } catch (error) {
            console.error('Error fetching portfolio:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const startKyc = async () => {
        setShowSumsub(true)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        )
    }

    if (accessDenied) {
        return (
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                <div className="flex items-center gap-2 text-yellow-400 mb-2">
                    <AlertCircle className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Portfolio Unavailable</h3>
                </div>
                <p className="text-gray-300 text-sm">
                    This account does not have investor portfolio access.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Briefcase className="w-7 h-7 text-blue-400" />
                Portfolio Analytics
            </h2>

            {/* Top Cards & Identity Verification Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                    <p className="text-gray-400 text-sm mb-1">Total AUM</p>
                    <p className="text-3xl font-bold text-white tracking-tight">
                        ${summary.totalAum.toLocaleString()}
                    </p>
                    <div className="mt-2 text-gray-500 text-xs">
                        Current portfolio valuation
                    </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                    <p className="text-gray-400 text-sm mb-1">Active Positions</p>
                    <p className="text-3xl font-bold text-white tracking-tight">{summary.activePositions}</p>
                    <div className="mt-2 text-gray-500 text-xs">
                        Across {sectors.length} industries
                    </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                    <p className="text-gray-400 text-sm mb-1">Realized ROI</p>
                    <p className="text-3xl font-bold text-white tracking-tight">{summary.realizedRoi}%</p>
                    <div className="mt-2 flex items-center gap-1 text-blue-400 text-xs font-bold font-mono">
                        {summary.realizedRoi > 0 ? 'LIQUID PROFIT' : 'NO SALES YET'}
                    </div>
                </div>

                <div className={`border rounded-2xl p-6 flex flex-col justify-between ${summary.kycStatus === 'VERIFIED' ? 'bg-green-600/10 border-green-500/20' : 'bg-blue-600/10 border-blue-500/20'}`}>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <ShieldCheck className={`w-4 h-4 ${summary.kycStatus === 'VERIFIED' ? 'text-green-400' : 'text-blue-400'}`} />
                            <p className={`${summary.kycStatus === 'VERIFIED' ? 'text-green-400' : 'text-blue-400'} text-xs font-bold uppercase tracking-wider`}>Identity Status</p>
                        </div>
                        <p className="text-white font-bold text-sm">
                            {summary.kycStatus === 'VERIFIED' ? 'Verified Investor' :
                                summary.kycStatus === 'PENDING' ? 'Verification Pending' : 'Verification Required'}
                        </p>
                    </div>
                    {summary.kycStatus !== 'VERIFIED' && (
                        <button
                            onClick={startKyc}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all mt-2 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40"
                        >
                            {summary.kycStatus === 'PENDING' ? 'Check Status' : 'Verify Now'}
                            <ChevronRight className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Portfolio Allocation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                    <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-purple-400" />
                        Sector Allocation
                    </h3>
                    <div className="space-y-4">
                        {sectors.length > 0 ? sectors.map((item, i) => (
                            <div key={i} className="space-y-1.5">
                                <div className="flex justify-between text-xs font-medium">
                                    <span className="text-gray-300">{item.sector}</span>
                                    <span className="text-white">{item.allocation}%</span>
                                </div>
                                <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`${item.color} h-full transition-all duration-1000`}
                                        style={{ width: `${item.allocation}%` }}
                                    ></div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-8 text-gray-500">
                                No investments yet
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                    <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-400" />
                        Investment Performance
                    </h3>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {items.length > 0 ? items.map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-900/40 rounded-xl hover:bg-gray-900/60 transition-all cursor-pointer border border-transparent hover:border-gray-700">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg ${item.color} flex items-center justify-center text-white font-bold`}>
                                        {item.name[0]}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white truncate max-w-[120px]">{item.name}</p>
                                        <p className="text-[10px] text-gray-500 uppercase font-mono tracking-wider">{item.sector}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-white">${item.value.toLocaleString()}</p>
                                    <p className={`text-[10px] font-bold ${item.returns >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {item.returns >= 0 ? '+' : ''}{item.returns}%
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    {item.type !== 'LAUNCHPAD' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (item.investmentId) {
                                                    setSelectedSellItem(item);
                                                    setShowSellModal(true);
                                                } else {
                                                    addToast('error', 'Cannot sell this item');
                                                }
                                            }}
                                            className="p-2 hover:bg-green-500/20 text-green-400/60 hover:text-green-400 rounded-lg transition-colors"
                                            title="Sell Position"
                                        >
                                            <DollarSign className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedDeal({ id: item.id, name: item.name });
                                            setShowDisputeModal(true);
                                        }}
                                        className="p-2 hover:bg-red-500/20 text-red-400/60 hover:text-red-400 rounded-lg transition-colors"
                                        title="File Dispute"
                                    >
                                        <ShieldAlert className="w-4 h-4" />
                                    </button>
                                    <ArrowUpRight className="w-4 h-4 text-gray-600" />
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-8 text-gray-500">
                                No investments found
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {showSumsub && (
                <SumsubKyc
                    onClose={() => setShowSumsub(false)}
                    onComplete={() => {
                        setShowSumsub(false);
                        addToast('success', 'KYC Verification Completed');
                    }}
                />
            )}
            {showDisputeModal && selectedDeal && (
                <FileDisputeModal
                    dealId={selectedDeal.id}
                    dealTitle={selectedDeal.name}
                    onClose={() => setShowDisputeModal(false)}
                    onSuccess={() => {
                        setShowDisputeModal(false);
                    }}
                />
            )}
            {/* Sell Modal */}
            {showSellModal && selectedSellItem && selectedSellItem.investmentId && (
                <SellPositionModal
                    investmentId={selectedSellItem.investmentId}
                    parentId={selectedSellItem.parentId}
                    type={selectedSellItem.type}
                    dealName={selectedSellItem.name}
                    currentValue={selectedSellItem.shares || selectedSellItem.value}
                    onClose={() => setShowSellModal(false)}
                    onSuccess={() => {
                        setShowSellModal(false);
                        fetchPortfolioData();
                    }}
                />
            )}
        </div>
    )
}
