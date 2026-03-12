'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    ClipboardCheck,
    GripVertical,
    Eye,
    Shield,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Search,
    Filter,
    ArrowRight,
    Building2,
    Award
} from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useToast } from '../../contexts/ToastContext'
import { API_URL, authorizedRequest } from '@/lib/api'
import { useTranslations } from '@/hooks/useTranslations'

interface SME {
    id: string
    name: string
    sector: string
    stage: string
    status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'CERTIFIED' | 'REJECTED'
    score: number
    createdAt: string
}

interface Column {
    id: string
    title: string
    status: string
    color: string
}

export default function SMEPipelinePage() {
    const { addToast } = useToast()
    const { t } = useTranslations()
    const [smes, setSmes] = useState<SME[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [draggedSME, setDraggedSME] = useState<SME | null>(null)

    const columns: Column[] = [
        { id: 'submitted', title: 'Submitted', status: 'SUBMITTED', color: '#3B82F6' },
        { id: 'review', title: 'Under Review', status: 'UNDER_REVIEW', color: '#F59E0B' },
        { id: 'certified', title: 'Certified', status: 'CERTIFIED', color: '#10B981' },
        { id: 'rejected', title: 'Rejected', status: 'REJECTED', color: '#EF4444' }
    ]

    useEffect(() => {
        const fetchSMEs = async () => {
            try {
                const response = await authorizedRequest('/api/smes')

                if (response.ok) {
                    const data = await response.json()
                    setSmes(data)
                }
            } catch (error) {
                console.error('Error fetching SMEs:', error)
                addToast('error', 'Failed to load SME onboarding pipeline')
            } finally {
                setIsLoading(false)
            }
        }

        fetchSMEs()
    }, [addToast])

    const handleDragStart = (sme: SME) => {
        setDraggedSME(sme)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const handleDrop = async (status: string) => {
        if (!draggedSME || draggedSME.status === status) {
            setDraggedSME(null)
            return
        }

        try {
            const response = await authorizedRequest(`/api/smes/${draggedSME.id}`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            })

            if (response.ok) {
                setSmes(prev => prev.map(s => s.id === draggedSME.id ? { ...s, status: status as any } : s))
                addToast('success', `SME moved to ${status}`)
            } else {
                addToast('error', 'Failed to update SME status')
            }
        } catch (error) {
            console.error('Error updating SME:', error)
            addToast('error', 'Error updating SME status')
        }

        setDraggedSME(null)
    }

    const filteredSMEs = smes.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.sector.toLowerCase().includes(searchQuery.toLowerCase())
    )

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
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <ClipboardCheck className="w-8 h-8 text-blue-400" />
                        {t('advisory.pipeline')}
                    </h1>
                    <p className="text-gray-400 mt-1">{t('home.features.advisory.description')}</p>
                </div>
                <div className="flex gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder={t('common.search')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                        />
                    </div>
                </div>
            </div>

            <div className="flex gap-6 overflow-x-auto pb-6">
                {columns.map(column => (
                    <div
                        key={column.id}
                        className="w-80 flex-shrink-0"
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(column.status)}
                    >
                        <div
                            className="p-3 rounded-t-xl flex items-center justify-between border border-b-0 border-gray-700"
                            style={{ backgroundColor: `${column.color}15`, borderTop: `2px solid ${column.color}` }}
                        >
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-white uppercase text-xs tracking-wider">{column.title}</h3>
                                <span className="bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                    {filteredSMEs.filter(s => s.status === column.status).length}
                                </span>
                            </div>
                        </div>

                        <div className="bg-gray-900/50 border border-gray-700 rounded-b-xl p-3 min-h-[600px] space-y-3">
                            {filteredSMEs.filter(s => s.status === column.status).map(sme => (
                                <div
                                    key={sme.id}
                                    draggable
                                    onDragStart={() => handleDragStart(sme)}
                                    className={`bg-gray-800 border border-gray-700 rounded-xl p-4 cursor-move hover:border-gray-500 transition-all ${draggedSME?.id === sme.id ? 'opacity-40 scale-95' : ''
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="p-2 bg-blue-500/10 rounded-lg">
                                            <Building2 className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {sme.score > 0 && (
                                                <div className="px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-md text-[10px] font-bold flex items-center gap-1">
                                                    <Award className="w-3 h-3" />
                                                    Score: {Math.round(sme.score)}
                                                </div>
                                            )}
                                            <Link href={`/smes/${sme.id}`}>
                                                <Eye className="w-4 h-4 text-gray-500 hover:text-white" />
                                            </Link>
                                        </div>
                                    </div>

                                    <h4 className="font-bold text-white mb-1">{sme.name}</h4>
                                    <p className="text-gray-500 text-xs mb-4">{sme.sector} • {sme.stage}</p>

                                    <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
                                        <div className="flex items-center gap-1.5 text-gray-400 text-[10px]">
                                            <Clock className="w-3 h-3" />
                                            {new Date(sme.createdAt).toLocaleDateString()}
                                        </div>
                                        <Link
                                            href={`/smes/${sme.id}/assessment`}
                                            className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                        >
                                            {t('advisory.assessment')} <ArrowRight className="w-2.5 h-2.5" />
                                        </Link>
                                    </div>
                                </div>
                            ))}

                            {filteredSMEs.filter(s => s.status === column.status).length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-600 border-2 border-dashed border-gray-800 rounded-xl">
                                    <Shield className="w-8 h-8 mb-2 opacity-20" />
                                    <p className="text-xs">No SMEs here</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </DashboardLayout>
    )
}
