'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    KanbanSquare,
    GripVertical,
    Eye,
    DollarSign,
    Clock,
    TrendingUp,
    AlertCircle,
    ChevronRight,
    Calendar,
    Building2,
    Users,
    ArrowRight
} from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useToast } from '../../contexts/ToastContext'
import { authorizedRequest } from '@/lib/api'

interface PipelineStage {
    id: string
    name: string
    order: number
    color: string
}

interface PipelineDeal {
    id: string
    title: string
    smeId: string
    smeName: string
    investorId: string
    investorName: string
    amount: number
    stage: string
    stageOrder: number
    priority: 'HIGH' | 'MEDIUM' | 'LOW'
    daysInStage: number
    expectedClose: string
    progress: number
    lastActivity: string
}

interface PipelineSummary {
    totalDeals: number
    totalValue: number
    highPriority: number
    avgProgress: number
}

export default function PipelinePage() {
    const { addToast } = useToast()
    const [stages, setStages] = useState<PipelineStage[]>([])
    const [pipeline, setPipeline] = useState<{ [key: string]: PipelineDeal[] }>({})
    const [summary, setSummary] = useState<PipelineSummary | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [draggedDeal, setDraggedDeal] = useState<PipelineDeal | null>(null)

    useEffect(() => {
        const fetchPipeline = async () => {
            try {
                const userData = localStorage.getItem('user')

                if (!userData) {
                    window.location.href = '/auth/login'
                    return
                }

                const response = await authorizedRequest('/api/pipeline/deals')

                if (response.ok) {
                    const data = await response.json()
                    setStages(data.stages || [])
                    setPipeline(data.pipeline || {})
                    setSummary(data.summary || null)
                }
            } catch (error) {
                console.error('Error fetching pipeline:', error)
                addToast('error', 'Failed to load pipeline')
            } finally {
                setIsLoading(false)
            }
        }

        fetchPipeline()
    }, [addToast])

    const handleDragStart = (deal: PipelineDeal) => {
        setDraggedDeal(deal)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const handleDrop = async (stageName: string) => {
        if (!draggedDeal || draggedDeal.stage === stageName) {
            setDraggedDeal(null)
            return
        }

        try {
            const response = await authorizedRequest(`/api/pipeline/deals/${draggedDeal.id}/stage`, {
                method: 'PUT',
                body: JSON.stringify({ newStage: stageName })
            })

            if (response.ok) {
                // Update local state
                setPipeline(prev => {
                    const newPipeline = { ...prev }

                    // Remove from old stage
                    newPipeline[draggedDeal.stage] = newPipeline[draggedDeal.stage].filter(
                        d => d.id !== draggedDeal.id
                    )

                    // Add to new stage
                    const movedDeal = { ...draggedDeal, stage: stageName }
                    newPipeline[stageName] = [...(newPipeline[stageName] || []), movedDeal]

                    return newPipeline
                })

                addToast('success', `Deal moved to ${stageName}`)
            } else {
                addToast('error', 'Failed to move deal')
            }
        } catch (error) {
            console.error('Error moving deal:', error)
            addToast('error', 'Error moving deal')
        }

        setDraggedDeal(null)
    }

    const formatCurrency = (value: number) => {
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
        if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
        return `$${value}`
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'HIGH': return 'bg-red-500/20 text-red-400 border-red-500/30'
            case 'MEDIUM': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
            case 'LOW': return 'bg-green-500/20 text-green-400 border-green-500/30'
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
        }
    }

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <KanbanSquare className="w-8 h-8 text-purple-400" />
                        Deal Pipeline
                    </h1>
                    <p className="text-gray-400 mt-1">Drag and drop deals between stages to update their status</p>
                </div>
                <Link
                    href="/deals/create"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    + New Deal
                </Link>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-sm">Total Deals</p>
                                <p className="text-2xl font-bold text-white">{summary.totalDeals}</p>
                            </div>
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <KanbanSquare className="w-5 h-5 text-purple-400" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-sm">Total Value</p>
                                <p className="text-2xl font-bold text-white">{formatCurrency(summary.totalValue)}</p>
                            </div>
                            <div className="p-2 bg-green-500/20 rounded-lg">
                                <DollarSign className="w-5 h-5 text-green-400" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-sm">High Priority</p>
                                <p className="text-2xl font-bold text-white">{summary.highPriority}</p>
                            </div>
                            <div className="p-2 bg-red-500/20 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-red-400" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-sm">Avg. Progress</p>
                                <p className="text-2xl font-bold text-white">{summary.avgProgress}%</p>
                            </div>
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-blue-400" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Pipeline Kanban */}
            <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max">
                    {stages.map(stage => (
                        <div
                            key={stage.id}
                            className="w-80 flex-shrink-0"
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(stage.name)}
                        >
                            {/* Stage Header */}
                            <div
                                className="flex items-center justify-between p-3 rounded-t-xl"
                                style={{ backgroundColor: `${stage.color}20` }}
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: stage.color }}
                                    />
                                    <h3 className="font-semibold text-white">{stage.name}</h3>
                                    <span className="px-2 py-0.5 bg-gray-700 rounded-full text-xs text-gray-300">
                                        {pipeline[stage.name]?.length || 0}
                                    </span>
                                </div>
                                <span className="text-sm text-gray-400">
                                    {formatCurrency(
                                        (pipeline[stage.name] || []).reduce((sum, d) => sum + d.amount, 0)
                                    )}
                                </span>
                            </div>

                            {/* Deals Column */}
                            <div className="bg-gray-800/50 rounded-b-xl p-3 min-h-[500px] border border-gray-700 border-t-0 space-y-3">
                                {(pipeline[stage.name] || []).map(deal => (
                                    <div
                                        key={deal.id}
                                        draggable
                                        onDragStart={() => handleDragStart(deal)}
                                        className={`bg-gray-800 rounded-lg p-4 border border-gray-700 cursor-move hover:border-gray-600 transition-all ${draggedDeal?.id === deal.id ? 'opacity-50 scale-95' : ''
                                            }`}
                                    >
                                        {/* Deal Header */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <GripVertical className="w-4 h-4 text-gray-500" />
                                                <span className={`px-2 py-0.5 rounded text-xs border ${getPriorityColor(deal.priority)}`}>
                                                    {deal.priority}
                                                </span>
                                            </div>
                                            <Link href={`/deals/${deal.id}`}>
                                                <Eye className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                                            </Link>
                                        </div>

                                        {/* Deal Title */}
                                        <h4 className="font-semibold text-white mb-2 line-clamp-2">
                                            {deal.title}
                                        </h4>

                                        {/* Deal Info */}
                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center gap-2 text-gray-400">
                                                <Building2 className="w-4 h-4" />
                                                <span className="truncate">{deal.smeName}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-400">
                                                <Users className="w-4 h-4" />
                                                <span className="truncate">{deal.investorName}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-green-400">
                                                <DollarSign className="w-4 h-4" />
                                                <span className="font-semibold">{formatCurrency(deal.amount)}</span>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="mt-3">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-gray-400">Progress</span>
                                                <span className="text-white">{deal.progress}%</span>
                                            </div>
                                            <div className="w-full bg-gray-700 rounded-full h-1.5">
                                                <div
                                                    className="h-1.5 rounded-full transition-all"
                                                    style={{
                                                        width: `${deal.progress}%`,
                                                        backgroundColor: stage.color
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between text-xs text-gray-400">
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                <span>{deal.daysInStage} days</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                <span>Close: {new Date(deal.expectedClose).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Empty State */}
                                {(!pipeline[stage.name] || pipeline[stage.name].length === 0) && (
                                    <div className="text-center py-8 text-gray-500">
                                        <p className="text-sm">No deals in this stage</p>
                                        <p className="text-xs mt-1">Drag deals here to move them</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Stage Flow Indicator */}
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-400">
                {stages.map((stage, index) => (
                    <div key={stage.id} className="flex items-center gap-2">
                        <div
                            className="px-3 py-1 rounded-full text-xs"
                            style={{ backgroundColor: `${stage.color}20`, color: stage.color }}
                        >
                            {stage.name}
                        </div>
                        {index < stages.length - 1 && (
                            <ArrowRight className="w-4 h-4" />
                        )}
                    </div>
                ))}
            </div>
        </DashboardLayout>
    )
}
