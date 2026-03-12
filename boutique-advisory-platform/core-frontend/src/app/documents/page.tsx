'use client'

import { useState, useEffect } from 'react'
import {
    FileText,
    Upload,
    Trash2,
    Download,
    Eye,
    Shield,
    AlertCircle,
    CheckCircle,
    Clock
} from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useToast } from '../../contexts/ToastContext'
import { authorizedRequest } from '../../lib/api'

interface Document {
    id: string
    name: string
    type: string
    url: string
    size: number
    createdAt: string
}

export default function DocumentCenterPage() {
    const { addToast } = useToast()
    const [documents, setDocuments] = useState<Document[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isUploading, setIsUploading] = useState(false)

    const fetchDocuments = async () => {
        try {
            const response = await authorizedRequest('/api/documents')
            if (response.ok) {
                const data = await response.json()
                setDocuments(data.documents || [])
            }
        } catch (error) {
            console.error('Error fetching documents:', error)
            addToast('error', 'Failed to load documents')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchDocuments()
    }, [])

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('name', file.name)
        formData.append('type', 'OTHER') // Default

        try {
            const response = await authorizedRequest('/api/documents/upload', {
                method: 'POST',
                body: formData
            })

            if (response.ok) {
                addToast('success', 'Document uploaded successfully')
                fetchDocuments()
            } else {
                addToast('error', 'Upload failed')
            }
        } catch (error) {
            console.error('Upload error:', error)
            addToast('error', 'Error uploading document')
        } finally {
            setIsUploading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this document?')) return

        try {
            const response = await authorizedRequest(`/api/documents/${id}`, {
                method: 'DELETE'
            })
            if (response.ok) {
                addToast('success', 'Document deleted')
                fetchDocuments()
            }
        } catch (error) {
            addToast('error', 'Failed to delete document')
        }
    }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return (
        <DashboardLayout>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Shield className="w-8 h-8 text-blue-400" />
                        Document Secure Vault
                    </h1>
                    <p className="text-gray-400 mt-2">Manage your sensitive business documents with high-grade security</p>
                </div>
                <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-blue-900/40">
                    {isUploading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                        <Upload className="w-4 h-4" />
                    )}
                    Upload Document
                    <input type="file" className="hidden" onChange={handleUpload} disabled={isUploading} />
                </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    Array(3).fill(0).map((_, i) => (
                        <div key={i} className="bg-gray-800 rounded-xl p-6 animate-pulse h-40 border border-gray-700"></div>
                    ))
                ) : documents.length === 0 ? (
                    <div className="col-span-full bg-gray-800 rounded-xl p-12 text-center border border-gray-700 border-dashed">
                        <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4 opacity-50" />
                        <h3 className="text-xl font-semibold text-white mb-2">No Documents Yet</h3>
                        <p className="text-gray-400">Upload your pitch deck, financials, and business plans here.</p>
                    </div>
                ) : (
                    documents.map((doc) => (
                        <div key={doc.id} className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500/50 transition-all group">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(doc.id)} className="p-1.5 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-white font-bold truncate pr-4" title={doc.name}>{doc.name}</h3>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-700 text-gray-400 px-2 py-0.5 rounded">
                                    {doc.type}
                                </span>
                                <span className="text-xs text-gray-500">{formatSize(doc.size)}</span>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(doc.createdAt).toLocaleDateString()}
                                </span>
                                <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    <Download className="w-5 h-5" />
                                </a>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Compliance Note */}
            <div className="mt-12 bg-gray-800/50 border border-gray-700 rounded-xl p-6 flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-yellow-500 shrink-0" />
                <div>
                    <h4 className="text-white font-bold mb-1">Compliance & Privacy</h4>
                    <p className="text-sm text-gray-400">
                        All documents uploaded are encrypted at rest. Access is restricted to certified Advisors and Investors with whom you have shared interest.
                        For certification, please ensure you have at least a **Pitch Deck** and **Latest Financials** uploaded.
                    </p>
                </div>
            </div>
        </DashboardLayout>
    )
}
