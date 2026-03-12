'use client'

import { useState } from 'react'
import { FileText, Download, PenTool, CheckCircle, Clock, Shield } from 'lucide-react'

export default function TemplateGenerator() {
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [generatedDoc, setGeneratedDoc] = useState<any>(null)

    const templates = [
        { id: 'nda', name: 'Mutual Non-Disclosure Agreement', icon: Shield, description: 'Standard NDA for initial deal discussions.' },
        { id: 'term_sheet', name: 'Series A Term Sheet', icon: FileText, description: 'Economic and governance terms for equity investment.' },
        { id: 'convertible_note', name: 'Convertible Promissory Note', icon: Clock, description: 'Short-term debt that converts into equity.' },
    ]

    const handleGenerate = () => {
        setIsGenerating(true)
        // Simulate document generation
        setTimeout(() => {
            setGeneratedDoc({
                name: `${selectedTemplate?.toUpperCase()}_Tech_Startup_A.pdf`,
                size: '42KB',
                date: new Date().toLocaleDateString()
            })
            setIsGenerating(false)
        }, 1500)
    }

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
                <PenTool className="w-5 h-5 text-blue-400" />
                Legal Document Generator
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {templates.map((tpl) => (
                    <button
                        key={tpl.id}
                        onClick={() => setSelectedTemplate(tpl.id)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${selectedTemplate === tpl.id
                                ? 'border-blue-500 bg-blue-500/10'
                                : 'border-gray-700 bg-gray-900/40 hover:border-gray-600'
                            }`}
                    >
                        <tpl.icon className={`w-6 h-6 mb-3 ${selectedTemplate === tpl.id ? 'text-blue-400' : 'text-gray-500'}`} />
                        <h3 className="text-white font-bold text-sm">{tpl.name}</h3>
                        <p className="text-gray-500 text-[10px] mt-1">{tpl.description}</p>
                    </button>
                ))}
            </div>

            {selectedTemplate && !generatedDoc && (
                <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700 animate-in fade-in zoom-in-95">
                    <h4 className="text-white font-medium mb-4">Configuration</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                        <div>
                            <label className="text-gray-500 block mb-1">Company Name</label>
                            <input type="text" value="Tech Startup A" readOnly className="w-full bg-gray-800 border-gray-700 rounded-lg text-white" />
                        </div>
                        <div>
                            <label className="text-gray-500 block mb-1">Governing Law</label>
                            <input type="text" value="Laws of Cambodia" readOnly className="w-full bg-gray-800 border-gray-700 rounded-lg text-white" />
                        </div>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                Generating Document...
                            </>
                        ) : (
                            <>
                                <Download className="w-5 h-5" />
                                Generate & Draft to Dataroom
                            </>
                        )}
                    </button>
                </div>
            )}

            {generatedDoc && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-green-500/20 p-3 rounded-xl">
                            <CheckCircle className="w-8 h-8 text-green-400" />
                        </div>
                        <div>
                            <h4 className="text-white font-bold">{generatedDoc.name}</h4>
                            <p className="text-gray-400 text-xs">Generated on {generatedDoc.date} • {generatedDoc.size}</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-700 text-sm">
                            View Draft
                        </button>
                        <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm">
                            Send for E-Signature
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
