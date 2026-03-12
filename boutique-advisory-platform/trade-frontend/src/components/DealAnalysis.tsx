'use client'

import { useState } from 'react'
import { Sparkles, ShieldCheck, AlertCircle, Terminal, RefreshCw, ChevronRight } from 'lucide-react'
import { authorizedRequest } from '../lib/api'

interface DealAnalysisProps {
    dealId: string
}

export default function DealAnalysis({ dealId }: DealAnalysisProps) {
    const [analysis, setAnalysis] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(false)

    const runAnalysis = async () => {
        setIsLoading(true)
        try {
            const response = await authorizedRequest(`/api/ai/analyze/${dealId}`, {
                method: 'POST'
            })
            if (response.ok) {
                const data = await response.json()
                setAnalysis(data)
            }
        } catch (error) {
            console.error('Analysis error:', error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-purple-600/10">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Gemini AI Intelligence</h2>
                        <p className="text-gray-400 text-xs">Automated deal evaluation & risk assessment</p>
                    </div>
                </div>
                {!analysis && !isLoading && (
                    <button
                        onClick={runAnalysis}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                    >
                        Run Analysis
                    </button>
                )}
                {analysis && (
                    <button
                        onClick={runAnalysis}
                        className="text-gray-400 hover:text-white p-2"
                        title="Re-run Analysis"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                )}
            </div>

            <div className="p-6">
                {isLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center space-y-4">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                            <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-blue-400 animate-pulse" />
                        </div>
                        <p className="text-gray-400 animate-pulse font-medium">Gemini is analyzing market data and financial records...</p>
                    </div>
                ) : analysis ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Summary Section */}
                        <div className="prose prose-invert max-w-none">
                            <div className="flex items-center gap-2 mb-4 text-blue-400">
                                <Terminal className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider font-mono">Executive Summary</span>
                            </div>
                            <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-700 leading-relaxed text-gray-300">
                                {analysis.summary.split('\n').map((line: string, i: number) => (
                                    <p key={i} className="mb-2 last:mb-0">{line.replace(/^#+\s/, '')}</p>
                                ))}
                            </div>
                        </div>

                        {/* Risk Matrix */}
                        <div>
                            <div className="flex items-center gap-2 mb-4 text-orange-400">
                                <ShieldCheck className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider font-mono">Risk Assessment Matrix</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {analysis.riskAnalysis.risks?.map((risk: any, i: number) => (
                                    <div key={i} className="bg-gray-900/30 border border-gray-700 rounded-xl p-4 hover:border-orange-500/30 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <div className="bg-orange-500/10 p-2 rounded-lg mt-1">
                                                <AlertCircle className="w-4 h-4 text-orange-400" />
                                            </div>
                                            <div>
                                                <h4 className="text-white font-bold text-sm">{risk.title}</h4>
                                                <p className="text-gray-400 text-xs mt-1 leading-relaxed">{risk.description}</p>
                                                <div className="mt-3 flex items-start gap-2 bg-green-500/5 p-2 rounded border border-green-500/10">
                                                    <ChevronRight className="w-3 h-3 text-green-400 mt-1 shrink-0" />
                                                    <p className="text-[10px] text-green-400 italic">Mitigation: {risk.mitigation}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 bg-gray-900/30 rounded-2xl border border-dashed border-gray-700">
                        <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-gray-300 font-bold">Unanalyzed Deal</h3>
                        <p className="text-gray-500 text-sm mt-2 max-w-xs mx-auto">
                            Use our proprietary AI engine to generate summaries and identify key investment risks.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
