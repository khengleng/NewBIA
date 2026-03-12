'use client'

import { useState } from 'react'
import { X, AlertTriangle, ShieldAlert, Send, Loader2 } from 'lucide-react'
import { authorizedRequest } from '../lib/api'
import { useToast } from '../contexts/ToastContext'

interface FileDisputeModalProps {
    dealId: string
    dealTitle: string
    onClose: () => void
    onSuccess?: () => void
}

export default function FileDisputeModal({ dealId, dealTitle, onClose, onSuccess }: FileDisputeModalProps) {
    const { addToast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        reason: '',
        description: ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (formData.reason.length < 5) {
            addToast('error', 'Please provide a more specific reason (min 5 characters)')
            return
        }

        if (formData.description.length < 20) {
            addToast('error', 'Please provide a detailed description (min 20 characters)')
            return
        }

        setIsSubmitting(true)
        try {
            const response = await authorizedRequest('/api/disputes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dealId,
                    ...formData
                })
            })

            if (response.ok) {
                addToast('success', 'Dispute filed successfully. An administrator will review it.')
                onSuccess?.()
                onClose()
            } else {
                const error = await response.json()
                addToast('error', error.error || 'Failed to file dispute')
            }
        } catch (error) {
            console.error('Error filing dispute:', error)
            addToast('error', 'A network error occurred')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gradient-to-r from-red-500/10 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                            <ShieldAlert className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">File a Dispute</h2>
                            <p className="text-xs text-gray-400">Formal report for deal mediation</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="text-amber-200 font-bold mb-1">Mediation Notice</p>
                            <p className="text-amber-200/70 leading-relaxed">
                                Disputes are reviewed by Boutique Advisory administrators. Filing a false or malicious dispute may result in account suspension.
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Target Deal</label>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-white font-medium">
                            {dealTitle}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="reason" className="block text-sm font-medium text-gray-400 mb-2">Primary Reason</label>
                        <input
                            id="reason"
                            type="text"
                            required
                            placeholder="e.g., Missing financial disclosures, Payment delay"
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all placeholder:text-gray-600"
                        />
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-400 mb-2">Detailed Description</label>
                        <textarea
                            id="description"
                            required
                            rows={4}
                            placeholder="Please explain the issue in detail, including dates and specific concerns..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all placeholder:text-gray-600 resize-none"
                        ></textarea>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-[2] bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/40"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <Send className="w-5 h-5" />
                                    Submit Formal Dispute
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
