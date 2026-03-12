'use client'

import { useState, useEffect } from 'react'
import { authorizedRequest } from '@/lib/api'
import { X, Rocket, AlertTriangle } from 'lucide-react'

interface CreateLaunchpadModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export default function CreateLaunchpadModal({ isOpen, onClose, onSuccess }: CreateLaunchpadModalProps) {
    const [deals, setDeals] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isFetchingDeals, setIsFetchingDeals] = useState(false)
    const [error, setError] = useState('')

    // Form fields
    const [selectedDealId, setSelectedDealId] = useState('')
    const [hardCap, setHardCap] = useState('')
    const [unitPrice, setUnitPrice] = useState('')
    const [minCommitment, setMinCommitment] = useState('')
    const [maxCommitment, setMaxCommitment] = useState('')
    const [startTime, setStartTime] = useState('')
    const [endTime, setEndTime] = useState('')

    useEffect(() => {
        if (isOpen) {
            fetchEligibleDeals()
        }
    }, [isOpen])

    const fetchEligibleDeals = async () => {
        setIsFetchingDeals(true)
        try {
            const response = await authorizedRequest('/api/launchpad/eligible-deals')
            if (response.ok) {
                const data = await response.json()
                setDeals(data)
            }
        } catch (err) {
            console.error('Failed to fetch eligible deals', err)
        } finally {
            setIsFetchingDeals(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            const response = await authorizedRequest('/api/launchpad', {
                method: 'POST',
                body: JSON.stringify({
                    dealId: selectedDealId,
                    hardCap: Number(hardCap),
                    unitPrice: Number(unitPrice),
                    minCommitment: Number(minCommitment),
                    maxCommitment: Number(maxCommitment),
                    startTime: new Date(startTime).toISOString(),
                    endTime: new Date(endTime).toISOString()
                })
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Failed to create launchpad offering')
            }

            onSuccess()
            onClose()
            resetForm()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    const resetForm = () => {
        setSelectedDealId('')
        setHardCap('')
        setUnitPrice('')
        setMinCommitment('')
        setMaxCommitment('')
        setStartTime('')
        setEndTime('')
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="p-6 border-b border-gray-700/50 flex justify-between items-center sticky top-0 bg-gray-800/90 backdrop-blur-md z-10">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                            <Rocket className="w-5 h-5 text-blue-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Initialize Launchpad Drop</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-center space-x-3 text-red-500">
                            <AlertTriangle className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {isFetchingDeals ? (
                        <div className="py-12 flex justify-center">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent flex items-center justify-center rounded-full animate-spin"></div>
                        </div>
                    ) : deals.length === 0 ? (
                        <div className="py-12 text-center">
                            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Rocket className="w-8 h-8 text-gray-500" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">No Eligible Deals</h3>
                            <p className="text-gray-400 max-w-sm mx-auto">There are no deals currently in Approved or Launchpad Prep status. Deals must pass due diligence first.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Select SME Deal</label>
                                <select
                                    required
                                    value={selectedDealId}
                                    onChange={(e) => setSelectedDealId(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">-- Choose a Deal --</option>
                                    {deals.map(deal => (
                                        <option key={deal.id} value={deal.id}>
                                            {deal.sme.companyName} - {deal.title} (${deal.amount.toLocaleString()})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Hard Cap Target ($)</label>
                                    <input
                                        type="number"
                                        required
                                        min="1000"
                                        value={hardCap}
                                        onChange={(e) => setHardCap(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g. 500000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Price Per Digital Unit ($)</label>
                                    <input
                                        type="number"
                                        required
                                        min="0.01"
                                        step="0.01"
                                        value={unitPrice}
                                        onChange={(e) => setUnitPrice(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g. 10.00"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Min Commitment ($)</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={minCommitment}
                                        onChange={(e) => setMinCommitment(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g. 1000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Max Commitment ($)</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={maxCommitment}
                                        onChange={(e) => setMaxCommitment(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g. 100000"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Start Timing</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">End Timing</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-700">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                                >
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Rocket className="w-5 h-5" />
                                            <span>Initialize Drop</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
