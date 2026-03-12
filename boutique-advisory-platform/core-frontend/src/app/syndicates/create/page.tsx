'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    Users,
    ArrowLeft,
    Save,
    DollarSign,
    Target,
    Clock,
    FileText,
    Percent,
    AlertCircle
} from 'lucide-react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { useToast } from '../../../contexts/ToastContext'
import usePermissions from '../../../hooks/usePermissions'
import { authorizedRequest } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003'

interface Deal {
    id: string
    title: string
    amount: number
}

export default function CreateSyndicatePage() {
    const router = useRouter()
    const { addToast } = useToast()
    const { isInvestor, isLoading: isPermissionsLoading } = usePermissions()
    const [isLoading, setIsLoading] = useState(false)
    const [isFetchingDeals, setIsFetchingDeals] = useState(true)
    const [deals, setDeals] = useState<Deal[]>([])

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        targetAmount: '',
        minInvestment: '1000',
        maxInvestment: '',
        managementFee: '2.0',
        carryFee: '20.0',
        dealId: '',
        closingDate: '',
        isTokenized: false,
        tokenName: '',
        tokenSymbol: '',
        pricePerToken: ''
    })

    useEffect(() => {
        if (!isPermissionsLoading && !isInvestor) {
            addToast('error', 'Only investors can create syndicates')
            router.push('/syndicates')
            return
        }
        fetchDeals()
    }, [isInvestor, isPermissionsLoading])

    const fetchDeals = async () => {
        try {
            const response = await authorizedRequest('/api/deals')
            if (response.ok) {
                const data = await response.json()
                setDeals(data)
            }
        } catch (error) {
            console.error('Error fetching deals:', error)
        } finally {
            setIsFetchingDeals(false)
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const response = await authorizedRequest('/api/syndicates', {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    targetAmount: parseFloat(formData.targetAmount),
                    minInvestment: parseFloat(formData.minInvestment),
                    maxInvestment: formData.maxInvestment ? parseFloat(formData.maxInvestment) : null,
                    managementFee: parseFloat(formData.managementFee),
                    carryFee: parseFloat(formData.carryFee),

                    // Tokenization fields
                    isTokenized: formData.isTokenized,
                    tokenName: formData.isTokenized ? formData.tokenName : null,
                    tokenSymbol: formData.isTokenized ? formData.tokenSymbol : null,
                    pricePerToken: formData.isTokenized ? parseFloat(formData.pricePerToken) : null,
                    totalTokens: formData.isTokenized && formData.targetAmount && formData.pricePerToken
                        ? Math.floor(parseFloat(formData.targetAmount) / parseFloat(formData.pricePerToken))
                        : null
                })
            })

            if (response.ok) {
                addToast('success', 'Syndicate created successfully!')
                router.push('/syndicates')
            } else {
                const error = await response.json()
                addToast('error', error.error || 'Failed to create syndicate')
            }
        } catch (error) {
            console.error('Error creating syndicate:', error)
            addToast('error', 'Error creating syndicate')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center text-gray-400 hover:text-white mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </button>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Users className="w-8 h-8 text-blue-400" />
                        Create New Syndicate
                    </h1>
                    <p className="text-gray-400 mt-2">Set up a pool to invest in a specific deal with other investors</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-400" />
                            Syndicate Details
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Syndicate Name *</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="e.g., Tech Growth Fund I"
                                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    required
                                    rows={4}
                                    placeholder="Explain the strategy and focus of this syndicate..."
                                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tokenization Options */}
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-cyan-400" />
                                Tokenization
                            </h2>
                            <label className="flex items-center cursor-pointer select-none">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        name="isTokenized"
                                        checked={formData.isTokenized}
                                        onChange={(e) => setFormData(prev => ({ ...prev, isTokenized: e.target.checked }))}
                                        className="sr-only"
                                    />
                                    <div className={`block w-14 h-8 rounded-full transition-colors ${formData.isTokenized ? 'bg-cyan-600' : 'bg-gray-600'}`}></div>
                                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${formData.isTokenized ? 'transform translate-x-6' : ''}`}></div>
                                </div>
                                <div className="ml-3 text-gray-300 font-medium">
                                    Enable Tokenization
                                </div>
                            </label>
                        </div>

                        {formData.isTokenized && (
                            <div className="space-y-6 animate-fadeIn">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Token Name *</label>
                                        <input
                                            type="text"
                                            name="tokenName"
                                            value={formData.tokenName}
                                            onChange={handleInputChange}
                                            required={formData.isTokenized}
                                            placeholder="e.g. Real Estate Fund Token"
                                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Token Symbol *</label>
                                        <input
                                            type="text"
                                            name="tokenSymbol"
                                            value={formData.tokenSymbol}
                                            onChange={handleInputChange}
                                            required={formData.isTokenized}
                                            placeholder="e.g. REFT"
                                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 uppercase"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Price Per Token ($) *</label>
                                        <input
                                            type="number"
                                            name="pricePerToken"
                                            value={formData.pricePerToken}
                                            onChange={handleInputChange}
                                            required={formData.isTokenized}
                                            min="0.01"
                                            step="0.01"
                                            placeholder="e.g. 100"
                                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>
                                </div>

                                <div className="bg-cyan-900/20 border border-cyan-700/30 rounded-lg p-4 text-sm text-cyan-200">
                                    <p className="font-bold flex items-center gap-2 mb-2">
                                        <AlertCircle className="w-4 h-4" />
                                        Token Supply Estimation
                                    </p>
                                    {formData.targetAmount && formData.pricePerToken ? (
                                        <p>
                                            Based on your target of <span className="text-white font-bold">${parseFloat(formData.targetAmount).toLocaleString()}</span> and price of <span className="text-white font-bold">${parseFloat(formData.pricePerToken).toLocaleString()}</span>,
                                            you will issue approximately <span className="text-white font-bold">{Math.floor(parseFloat(formData.targetAmount) / parseFloat(formData.pricePerToken)).toLocaleString()} {formData.tokenSymbol || 'Tokens'}</span>.
                                        </p>
                                    ) : (
                                        <p className="opacity-70">Enter target amount and token price to see supply estimate.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Financial Terms */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-green-400" />
                                Investment Strategy
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Target Amount ($) *</label>
                                    <input
                                        type="number"
                                        name="targetAmount"
                                        value={formData.targetAmount}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Min Investment</label>
                                        <input
                                            type="number"
                                            name="minInvestment"
                                            value={formData.minInvestment}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Max Investment</label>
                                        <input
                                            type="number"
                                            name="maxInvestment"
                                            value={formData.maxInvestment}
                                            onChange={handleInputChange}
                                            placeholder="Optional"
                                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                                <Percent className="w-5 h-5 text-purple-400" />
                                Fees & Revenue
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Management Fee (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        name="managementFee"
                                        value={formData.managementFee}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Typical: 2.0%</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Carry Fee (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        name="carryFee"
                                        value={formData.carryFee}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Typical: 20.0%</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Deal & Timeline */}
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                            <Target className="w-5 h-5 text-amber-400" />
                            Deal & Deadline
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Linked Deal (Optional)</label>
                                <select
                                    name="dealId"
                                    value={formData.dealId}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select a Deal</option>
                                    {deals.map(deal => (
                                        <option key={deal.id} value={deal.id}>{deal.title} (${(deal.amount / 1000).toFixed(0)}K)</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Closing Date</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="date"
                                        name="closingDate"
                                        value={formData.closingDate}
                                        onChange={handleInputChange}
                                        className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-900/20 rounded-xl p-4 border border-blue-700/50 flex gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
                        <p className="text-sm text-blue-300">
                            As the lead investor, you will be responsible for approving members and managing the syndicate's strategy.
                        </p>
                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors font-medium border border-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all font-bold shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isLoading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            Create Syndicate
                        </button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    )
}
