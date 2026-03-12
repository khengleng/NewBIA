'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    Award,
    Shield,
    TrendingUp,
    Users,
    Activity,
    Scale,
    AlertOctagon,
    Save,
    ArrowLeft,
    CheckCircle2,
    Info
} from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useToast } from '@/contexts/ToastContext'
import { API_URL, authorizedRequest } from '@/lib/api'

export default function AssessmentPage() {
    const params = useParams()
    const router = useRouter()
    const { addToast } = useToast()

    const [sme, setSme] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    const [scores, setScores] = useState({
        financialScore: 50,
        teamScore: 50,
        marketScore: 50,
        productScore: 50,
        legalScore: 50,
        operationalScore: 50
    })

    const [notes, setNotes] = useState({
        strengths: [''],
        weaknesses: [''],
        recommendations: [''],
        redFlags: ['']
    })

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [smeRes, ddRes] = await Promise.all([
                    authorizedRequest(`/api/smes/${params.id}`),
                    authorizedRequest(`/api/duediligence/sme/${params.id}`)
                ])

                if (smeRes.ok) {
                    const smeData = await smeRes.json()
                    setSme(smeData)
                }

                if (ddRes.ok) {
                    const ddData = await ddRes.json()
                    if (ddData) {
                        setScores({
                            financialScore: ddData.financialScore || 50,
                            teamScore: ddData.teamScore || 50,
                            marketScore: ddData.marketScore || 50,
                            productScore: ddData.productScore || 50,
                            legalScore: ddData.legalScore || 50,
                            operationalScore: ddData.operationalScore || 50
                        })
                        setNotes({
                            strengths: ddData.strengths || [''],
                            weaknesses: ddData.weaknesses || [''],
                            recommendations: ddData.recommendations || [''],
                            redFlags: ddData.redFlags || ['']
                        })
                    }
                }
            } catch (error) {
                console.error('Error fetching assessment:', error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [params.id])

    const handleScoreChange = (category: string, value: number) => {
        setScores(prev => ({ ...prev, [category]: value }))
    }

    const handleNoteChange = (type: keyof typeof notes, index: number, value: string) => {
        const newNotes = [...notes[type]]
        newNotes[index] = value
        setNotes(prev => ({ ...prev, [type]: newNotes }))
    }

    const addNoteField = (type: keyof typeof notes) => {
        setNotes(prev => ({ ...prev, [type]: [...prev[type], ''] }))
    }

    const removeNoteField = (type: keyof typeof notes, index: number) => {
        if (notes[type].length <= 1) return
        const newNotes = notes[type].filter((_, i) => i !== index)
        setNotes(prev => ({ ...prev, [type]: newNotes }))
    }

    const handleSave = async (status: 'PENDING' | 'COMPLETED' = 'PENDING') => {
        setIsSaving(true)
        try {
            // First check if DD exists
            const ddCheckRes = await authorizedRequest(`/api/duediligence/sme/${params.id}`)

            let method = 'POST'
            let url = `${API_URL}/api/duediligence`
            let body: any = { smeId: params.id, ...scores, ...notes, status }

            if (ddCheckRes.ok) {
                const existingDD = await ddCheckRes.json()
                if (existingDD && existingDD.id) {
                    method = 'PUT'
                    url = `${API_URL}/api/duediligence/${existingDD.id}`
                    body = { ...scores, ...notes, status }
                }
            }

            const response = await authorizedRequest(url, {
                method,
                body: JSON.stringify(body)
            })

            if (response.ok) {
                addToast('success', status === 'COMPLETED' ? 'Assessment finalized and certified!' : 'Assessment progress saved')
                if (status === 'COMPLETED') router.push(`/smes/${params.id}`)
            } else {
                addToast('error', 'Failed to save assessment')
            }
        } catch (error) {
            console.error('Save error:', error)
            addToast('error', 'Error saving assessment')
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) return (
        <DashboardLayout>
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
            </div>
        </DashboardLayout>
    )

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto pb-20">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => router.back()} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <Shield className="w-8 h-8 text-blue-400" />
                            Due Diligence Assessment
                        </h1>
                        <p className="text-gray-400">Evaluating <span className="text-white font-medium">{sme?.name}</span> for Boutique Advisory Certification</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Scoring Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
                            <div className="p-6 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-green-400" />
                                    Quantitative Scoring
                                </h2>
                                <div className="text-sm text-gray-400">Weighted Scale (0-100)</div>
                            </div>

                            <div className="p-8 space-y-10">
                                {/* Category Sliders */}
                                {[
                                    { id: 'financialScore', label: 'Financial Health', icon: Activity, color: 'blue' },
                                    { id: 'teamScore', label: 'Team & Leadership', icon: Users, color: 'purple' },
                                    { id: 'marketScore', label: 'Market Opportunity', icon: TrendingUp, color: 'green' },
                                    { id: 'productScore', label: 'Product / Tech Readiness', icon: Shield, color: 'yellow' },
                                    { id: 'legalScore', label: 'Legal & Compliance', icon: Scale, color: 'red' },
                                    { id: 'operationalScore', label: 'Operational Efficiency', icon: Info, color: 'indigo' }
                                ].map(cat => (
                                    <div key={cat.id} className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 bg-${cat.color}-500/10 rounded-lg`}>
                                                    <cat.icon className={`w-5 h-5 text-${cat.color}-400`} />
                                                </div>
                                                <span className="font-semibold text-white">{cat.label}</span>
                                            </div>
                                            <span className={`text-2xl font-black text-${cat.color}-400`}>{scores[cat.id as keyof typeof scores]}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0" max="100"
                                            value={scores[cat.id as keyof typeof scores]}
                                            onChange={(e) => handleScoreChange(cat.id, parseInt(e.target.value))}
                                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Qualitative Notes */}
                        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 space-y-8">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                                <CheckCircle2 className="w-5 h-5 text-blue-400" />
                                Qualitative Assessment
                            </h2>

                            {[
                                { id: 'strengths', label: 'Key Strengths', color: 'green' },
                                { id: 'weaknesses', label: 'Identified Weaknesses', color: 'yellow' },
                                { id: 'recommendations', label: 'Advisory Recommendations', color: 'blue' },
                                { id: 'redFlags', label: 'Critical Red Flags', color: 'red' }
                            ].map(section => (
                                <div key={section.id} className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className={`text-sm font-bold text-${section.color}-400 uppercase tracking-widest`}>{section.label}</label>
                                        <button onClick={() => addNoteField(section.id as any)} className="text-[10px] bg-gray-700 p-1 rounded hover:bg-gray-600 text-white font-bold">+ ADD ITEM</button>
                                    </div>
                                    <div className="space-y-2">
                                        {notes[section.id as keyof typeof notes].map((note, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <input
                                                    value={note}
                                                    onChange={(e) => handleNoteChange(section.id as any, idx, e.target.value)}
                                                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:border-blue-500 outline-none"
                                                    placeholder={`Enter ${section.label.toLowerCase()}...`}
                                                />
                                                <button onClick={() => removeNoteField(section.id as any, idx)} className="p-2 text-gray-500 hover:text-red-400">×</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Meta Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 text-white shadow-xl shadow-blue-500/10">
                            <h3 className="font-bold text-lg mb-2">Final Certification</h3>
                            <p className="text-blue-100 text-xs mb-6 leading-relaxed">
                                Completing this assessment will calculate the final score and move the SME to the <b>Under Review</b> stage. Only certified SMEs are visible to the public deal marketplace.
                            </p>

                            <div className="space-y-3">
                                <button
                                    onClick={() => handleSave('COMPLETED')}
                                    disabled={isSaving}
                                    className="w-full py-4 bg-white text-blue-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors"
                                >
                                    <Award className="w-5 h-5" />
                                    FINALIZE & CERTIFY
                                </button>
                                <button
                                    onClick={() => handleSave('PENDING')}
                                    disabled={isSaving}
                                    className="w-full py-3 bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-650 transition-colors"
                                >
                                    <Save className="w-4 h-4" />
                                    SAVE DRAFT
                                </button>
                            </div>
                        </div>

                        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                            <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                                <AlertOctagon className="w-4 h-4 text-yellow-400" />
                                Compliance Check
                            </h4>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-4 h-4 rounded border border-gray-600 flex items-center justify-center text-[8px] text-blue-400">✓</div>
                                    <span className="text-xs text-gray-400">Identity Verified</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-4 h-4 rounded border border-gray-600"></div>
                                    <span className="text-xs text-gray-400">Financial Audit Linked</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-4 h-4 rounded border border-gray-600"></div>
                                    <span className="text-xs text-gray-400">Legal Ownership Confirmed</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
