'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
    FolderLock, FileText, Download, Eye, Upload, Search, Filter, Clock, User, Shield,
    BarChart3, File, FileSpreadsheet, Folder, Activity, Lock, ChevronRight, Menu, X,
    CheckSquare, Square, Trash2, Archive, RotateCcw, Share2, AlertCircle, ZoomIn,
    ChevronLeft, ChevronDown, Users, Calendar, RefreshCw
} from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useToast } from '../../contexts/ToastContext'
import { API_URL, authorizedRequest } from '@/lib/api'

interface DataRoomDocument {
    id: string
    name: string
    category: string
    size: string
    uploadedBy: string
    uploadedAt: string
    accessCount: number
    lastAccessedBy: string | null
    lastAccessedAt: string | null
    url?: string
    versions?: { version: number; uploadedAt: string; uploadedBy: string }[]
}

interface DataRoom {
    id: string
    dealId: string
    name: string
    status: string
    createdBy: string
    accessList: string[]
    documents: DataRoomDocument[]
    activityLog: { action: string; documentId: string; userName: string; timestamp: string }[]
    createdAt: string
}

interface User {
    id: string
    userId: string
    role: string
}

export default function DataRoomPage() {
    const { addToast } = useToast()
    const [user, setUser] = useState<User | null>(null)
    const [dataRooms, setDataRooms] = useState<DataRoom[]>([])
    const [selectedRoom, setSelectedRoom] = useState<DataRoom | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [showMobileSidebar, setShowMobileSidebar] = useState(false)
    const [showPermissionsModal, setShowPermissionsModal] = useState(false)
    const [showVersionModal, setShowVersionModal] = useState(false)
    const [showPreviewModal, setShowPreviewModal] = useState(false)
    const [previewDocument, setPreviewDocument] = useState<DataRoomDocument | null>(null)
    const [selectedDocument, setSelectedDocument] = useState<DataRoomDocument | null>(null)
    const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set())
    const [isDragging, setIsDragging] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [isUploading, setIsUploading] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [showAnalytics, setShowAnalytics] = useState(false)
    const [analyticsData, setAnalyticsData] = useState<any>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const dropZoneRef = useRef<HTMLDivElement>(null)
    const touchStartX = useRef(0)
    const touchStartY = useRef(0)

    const [uploadForm, setUploadForm] = useState({
        name: '',
        category: 'General',
        file: null as File | null
    })

    const normalizeDocument = (doc: any): DataRoomDocument => ({
        id: String(doc?.id || ''),
        name: String(doc?.name || 'Untitled Document'),
        category: String(doc?.category || doc?.type || 'OTHER'),
        size: String(doc?.size || '0 MB'),
        uploadedBy: String(doc?.uploadedBy || 'system'),
        uploadedAt: String(doc?.uploadedAt || new Date().toISOString()),
        accessCount: Number(doc?.accessCount || 0),
        lastAccessedBy: doc?.lastAccessedBy || null,
        lastAccessedAt: doc?.lastAccessedAt || null,
        url: typeof doc?.url === 'string' ? doc.url : undefined,
        versions: Array.isArray(doc?.versions) ? doc.versions : []
    })

    const normalizeRoom = (room: any): DataRoom => ({
        id: String(room?.id || ''),
        dealId: String(room?.dealId || room?.id || ''),
        name: String(room?.name || room?.dealName || 'Data Room'),
        status: String(room?.status || 'ACTIVE'),
        createdBy: String(room?.createdBy || room?.smeName || 'system'),
        accessList: Array.isArray(room?.accessList) ? room.accessList : [],
        documents: Array.isArray(room?.documents) ? room.documents.map(normalizeDocument) : [],
        activityLog: Array.isArray(room?.activityLog) ? room.activityLog : [],
        createdAt: String(room?.createdAt || room?.lastUpdate || new Date().toISOString())
    })

    // Pull-to-refresh
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        const touchY = e.touches[0].clientY
        const diff = touchY - touchStartY.current

        if (diff > 100 && window.scrollY === 0 && !isRefreshing) {
            handleRefresh()
        }
    }

    const handleRefresh = async () => {
        setIsRefreshing(true)
        // Haptic feedback
        if ('vibrate' in navigator) {
            navigator.vibrate(50)
        }

        await fetchDataRooms()

        setTimeout(() => {
            setIsRefreshing(false)
        }, 1000)
    }

    const fetchDataRooms = async () => {
        try {
            const userData = localStorage.getItem('user')

            if (!userData) {
                window.location.href = '/auth/login'
                return
            }

            setUser(JSON.parse(userData))

            const response = await authorizedRequest('/api/dataroom')

            if (response.ok) {
                const data = await response.json()
                const normalized = Array.isArray(data) ? data.map(normalizeRoom) : []
                setDataRooms(normalized)
                if (normalized.length > 0) {
                    setSelectedRoom(normalized[0])
                }
            }
        } catch (error) {
            console.error('Error fetching data rooms:', error)
            addToast('error', 'Failed to load data rooms')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchDataRooms()
    }, [])

    const fetchAnalytics = async () => {
        if (!selectedRoom) return

        try {
            const response = await authorizedRequest(`/api/dataroom/${selectedRoom.dealId}/analytics`)

            if (response.ok) {
                const data = await response.json()
                setAnalyticsData(data)
            }
        } catch (error) {
            console.error('Error fetching analytics:', error)
        }
    }

    useEffect(() => {
        if (showAnalytics && selectedRoom) {
            fetchAnalytics()
        }
    }, [showAnalytics, selectedRoom])

    // Drag and drop handlers
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.currentTarget === dropZoneRef.current) {
            setIsDragging(false)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const files = Array.from(e.dataTransfer.files)
        if (files.length > 0) {
            handleFileSelect(files[0])
        }
    }

    const handleFileSelect = (file: File) => {
        // Validate file
        const maxSize = 10 * 1024 * 1024 // 10MB
        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/png', 'image/jpeg']

        if (file.size > maxSize) {
            addToast('error', 'File size must be less than 10MB')
            return
        }

        if (!allowedTypes.includes(file.type)) {
            addToast('error', 'File type not supported. Please upload PDF, DOCX, XLSX, PNG, or JPG')
            return
        }

        setUploadForm(prev => ({ ...prev, file, name: file.name }))
        setShowUploadModal(true)
    }

    const handleUploadDocument = async () => {
        if (!selectedRoom || !uploadForm.file) return

        setIsUploading(true)
        setUploadProgress(0)

        try {
            // Simulate upload progress
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval)
                        return 90
                    }
                    return prev + 10
                })
            }, 200)

            const formData = new FormData()
            formData.append('file', uploadForm.file)
            formData.append('name', uploadForm.name)
            formData.append('category', uploadForm.category)

            // In production, this would upload to S3/R2
            // For now, we'll simulate it
            await new Promise(resolve => setTimeout(resolve, 2000))

            clearInterval(progressInterval)
            setUploadProgress(100)

            const newDoc: DataRoomDocument = {
                id: Date.now().toString(),
                name: uploadForm.name,
                category: uploadForm.category,
                size: `${(uploadForm.file.size / 1024 / 1024).toFixed(2)} MB`,
                uploadedBy: user?.userId || 'Current User',
                uploadedAt: new Date().toISOString(),
                accessCount: 0,
                lastAccessedBy: null,
                lastAccessedAt: null,
                versions: [{ version: 1, uploadedAt: new Date().toISOString(), uploadedBy: user?.userId || 'Current User' }]
            }

            setSelectedRoom(prev => {
                if (!prev) return prev
                return { ...prev, documents: [...prev.documents, newDoc] }
            })

            addToast('success', 'Document uploaded successfully')
            setShowUploadModal(false)
            setUploadForm({ name: '', category: 'General', file: null })
            setUploadProgress(0)

            // Haptic feedback
            if ('vibrate' in navigator) {
                navigator.vibrate([50, 100, 50])
            }
        } catch (error) {
            console.error('Error uploading document:', error)
            addToast('error', 'Failed to upload document')
        } finally {
            setIsUploading(false)
        }
    }

    const handleViewDocument = async (doc: DataRoomDocument) => {
        if (!selectedRoom) return

        // Haptic feedback
        if ('vibrate' in navigator) {
            navigator.vibrate(30)
        }

        try {
            await authorizedRequest(`/api/dataroom/${selectedRoom.dealId}/documents/${doc.id}/access`, {
                method: 'POST',
                body: JSON.stringify({ action: 'VIEWED' })
            })

            // Update local state
            setSelectedRoom(prev => {
                if (!prev) return prev
                return {
                    ...prev,
                    documents: prev.documents.map(d =>
                        d.id === doc.id
                            ? { ...d, accessCount: d.accessCount + 1, lastAccessedAt: new Date().toISOString() }
                            : d
                    )
                }
            })

            // Show preview modal
            setPreviewDocument(doc)
            setShowPreviewModal(true)
        } catch (error) {
            console.error('Error logging view:', error)
        }
    }

    const handleDownloadDocument = async (doc: DataRoomDocument) => {
        if (!selectedRoom) return

        // Haptic feedback
        if ('vibrate' in navigator) {
            navigator.vibrate(50)
        }

        try {
            await authorizedRequest(`/api/dataroom/${selectedRoom.dealId}/documents/${doc.id}/access`, {
                method: 'POST',
                body: JSON.stringify({ action: 'DOWNLOADED' })
            })

            if (!doc.url) {
                addToast('error', 'File URL is not available for this document')
                return
            }

            window.open(doc.url, '_blank', 'noopener,noreferrer')
            addToast('success', `Downloading: ${doc.name}`)
        } catch (error) {
            console.error('Error logging download:', error)
            addToast('error', 'Failed to download document')
        }
    }

    const toggleDocumentSelection = (docId: string) => {
        // Haptic feedback
        if ('vibrate' in navigator) {
            navigator.vibrate(20)
        }

        setSelectedDocuments(prev => {
            const newSet = new Set(prev)
            if (newSet.has(docId)) {
                newSet.delete(docId)
            } else {
                newSet.add(docId)
            }
            return newSet
        })
    }

    const handleBulkDownload = () => {
        if (selectedDocuments.size === 0) return

        // Haptic feedback
        if ('vibrate' in navigator) {
            navigator.vibrate([50, 100, 50])
        }

        addToast('success', `Downloading ${selectedDocuments.size} documents...`)
        setSelectedDocuments(new Set())
    }

    const handleBulkDelete = () => {
        if (selectedDocuments.size === 0) return

        // Haptic feedback
        if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100])
        }

        if (confirm(`Delete ${selectedDocuments.size} documents?`)) {
            setSelectedRoom(prev => {
                if (!prev) return prev
                return {
                    ...prev,
                    documents: prev.documents.filter(d => !selectedDocuments.has(d.id))
                }
            })
            addToast('success', `Deleted ${selectedDocuments.size} documents`)
            setSelectedDocuments(new Set())
        }
    }

    const getCategories = () => {
        if (!selectedRoom) return []
        const categories = [...new Set(selectedRoom.documents.map(d => d.category))]
        return categories
    }

    const getFileIcon = (name: string) => {
        const ext = name?.split('.').pop()?.toLowerCase()
        if (ext === 'pdf') return <File className="w-6 h-6 sm:w-8 sm:h-8 text-red-400" />
        if (['xlsx', 'xls', 'csv'].includes(ext || '')) return <FileSpreadsheet className="w-6 h-6 sm:w-8 sm:h-8 text-green-400" />
        return <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
    }

    const filteredDocuments = selectedRoom?.documents.filter(doc => {
        const matchesSearch = (doc.name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory
        return matchesSearch && matchesCategory
    }) || []

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
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
            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                className="relative"
            >
                {/* Pull-to-refresh indicator */}
                {isRefreshing && (
                    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4">
                        <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Refreshing...</span>
                        </div>
                    </div>
                )}

                {/* Mobile Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
                    <div className="flex-1 w-full sm:w-auto">
                        <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
                            <FolderLock className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400" />
                            <span className="truncate">Virtual Data Room</span>
                        </h1>
                        <p className="text-gray-400 mt-1 text-sm sm:text-base">Secure document sharing and tracking</p>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setShowMobileSidebar(!showMobileSidebar)}
                        className="sm:hidden fixed bottom-4 right-4 z-40 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg touch-manipulation"
                    >
                        <Menu className="w-6 h-6" />
                    </button>

                    {/* Upload Button */}
                    {(user?.role === 'ADMIN' || user?.role === 'ADVISOR') && (
                        <button
                            onClick={() => setShowUploadModal(true)}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 sm:py-2 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm sm:text-base touch-manipulation"
                        >
                            <Upload className="w-4 h-4" />
                            <span>Upload</span>
                        </button>
                    )}
                </div>

                {/* Bulk Actions Bar */}
                {selectedDocuments.size > 0 && (
                    <div className="bg-blue-600 rounded-lg p-3 mb-4 flex items-center justify-between">
                        <span className="text-white font-medium">{selectedDocuments.size} selected</span>
                        <div className="flex gap-2">
                            <button
                                onClick={handleBulkDownload}
                                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg touch-manipulation"
                                title="Download selected"
                            >
                                <Download className="w-4 h-4 text-white" />
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className="p-2 bg-red-500/50 hover:bg-red-500/70 rounded-lg touch-manipulation"
                                title="Delete selected"
                            >
                                <Trash2 className="w-4 h-4 text-white" />
                            </button>
                            <button
                                onClick={() => setSelectedDocuments(new Set())}
                                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg touch-manipulation"
                                title="Clear selection"
                            >
                                <X className="w-4 h-4 text-white" />
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex gap-4 sm:gap-6 relative">
                    {/* Mobile Sidebar Overlay */}
                    {showMobileSidebar && (
                        <div
                            className="fixed inset-0 bg-black/70 z-30 sm:hidden"
                            onClick={() => setShowMobileSidebar(false)}
                        />
                    )}

                    {/* Data Room Selector */}
                    <div className={`
                        fixed sm:relative inset-y-0 left-0 z-40 sm:z-0
                        w-80 sm:w-72 bg-gray-800 rounded-none sm:rounded-xl p-4 border-r sm:border border-gray-700 h-screen sm:h-fit
                        transform transition-transform duration-300 ease-in-out
                        ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
                        overflow-y-auto
                    `}>
                        <button
                            onClick={() => setShowMobileSidebar(false)}
                            className="sm:hidden absolute top-4 right-4 p-2 text-gray-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                            <Folder className="w-5 h-5 text-yellow-400" />
                            Data Rooms
                        </h3>
                        <div className="space-y-2">
                            {dataRooms.map(room => (
                                <div
                                    key={room.id}
                                    onClick={() => {
                                        setSelectedRoom(room)
                                        setShowMobileSidebar(false)
                                        if ('vibrate' in navigator) navigator.vibrate(20)
                                    }}
                                    className={`p-3 rounded-lg cursor-pointer transition-colors touch-manipulation ${selectedRoom?.id === room.id
                                        ? 'bg-blue-600/20 border border-blue-500/30'
                                        : 'bg-gray-700/50 hover:bg-gray-700 border border-transparent active:bg-gray-600'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-white font-medium text-sm line-clamp-2">{room.name}</h4>
                                            <p className="text-gray-400 text-xs mt-1">{room.documents.length} documents</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-xs flex-shrink-0 ml-2 ${room.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                            {room.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {dataRooms.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                <FolderLock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No data rooms available</p>
                            </div>
                        )}
                    </div>

                    {/* Documents Area */}
                    <div className="flex-1 min-w-0">
                        {selectedRoom ? (
                            <>
                                {/* Room Header */}
                                <div className="bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700 mb-4 sm:mb-6">
                                    <div className="space-y-3 sm:space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h2 className="text-lg sm:text-xl font-bold text-white line-clamp-2">{selectedRoom.name}</h2>
                                                <p className="text-gray-400 text-xs sm:text-sm mt-1">
                                                    Created {formatDate(selectedRoom.createdAt)} • {selectedRoom.documents.length} docs
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setShowPermissionsModal(true)}
                                                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg touch-manipulation"
                                                title="Manage permissions"
                                            >
                                                <Shield className="w-4 h-4 text-blue-400" />
                                            </button>
                                        </div>

                                        {/* Stats */}
                                        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
                                            <div className="flex items-center gap-2 text-gray-400 whitespace-nowrap flex-shrink-0">
                                                <Shield className="w-4 h-4" />
                                                <span className="text-xs sm:text-sm">{selectedRoom.accessList.length} users</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-400 whitespace-nowrap flex-shrink-0">
                                                <Activity className="w-4 h-4" />
                                                <span className="text-xs sm:text-sm">{selectedRoom.activityLog.length} activities</span>
                                            </div>
                                            {(user?.role === 'SME' || user?.role === 'ADMIN') && (
                                                <button
                                                    onClick={() => setShowAnalytics(!showAnalytics)}
                                                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${showAnalytics ? 'bg-blue-600 text-white' : 'bg-gray-700 text-blue-400 hover:bg-gray-600'
                                                        }`}
                                                >
                                                    <BarChart3 className="w-3 h-3" />
                                                    Analytics
                                                </button>
                                            )}
                                        </div>

                                        {/* Analytics Dashboard */}
                                        {showAnalytics && analyticsData && (
                                            <div className="bg-gray-700/50 rounded-lg p-4 mb-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                            <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
                                                <p className="text-gray-400 text-xs uppercase font-medium">Unique Visitors</p>
                                                        <p className="text-2xl font-bold text-white mt-1">{analyticsData?.visitorStats?.uniqueVisitors || 0}</p>
                                                    </div>
                                                    <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
                                                        <p className="text-gray-400 text-xs uppercase font-medium">Total Views</p>
                                                        <p className="text-2xl font-bold text-blue-400 mt-1">{analyticsData?.visitorStats?.totalViews || 0}</p>
                                                    </div>
                                                    <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
                                                        <p className="text-gray-400 text-xs uppercase font-medium">Total Downloads</p>
                                                        <p className="text-2xl font-bold text-green-400 mt-1">{analyticsData?.visitorStats?.totalDownloads || 0}</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-white mb-3">Top Documents</h4>
                                                        <div className="space-y-2">
                                                            {(analyticsData?.topDocuments || []).map((doc: any, i: number) => (
                                                                <div key={i} className="flex justify-between items-center bg-gray-800 p-2 rounded text-sm">
                                                                    <div className="flex items-center gap-2 truncate flex-1">
                                                                        <span className="text-gray-500 w-4 text-xs font-mono">{i + 1}</span>
                                                                        <FileText className="w-3 h-3 text-blue-400" />
                                                                        <span className="text-gray-300 truncate">{doc.name}</span>
                                                                    </div>
                                                                    <div className="flex gap-3 text-xs text-gray-400">
                                                                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {doc.views}</span>
                                                                        <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {doc.downloads}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <h4 className="text-sm font-semibold text-white mb-3">Top Interested Investors</h4>
                                                        <div className="space-y-2">
                                                            {(analyticsData?.topInvestors || []).map((inv: any, i: number) => (
                                                                <div key={i} className="flex justify-between items-center bg-gray-800 p-2 rounded text-sm">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-700 text-gray-400'
                                                                            }`}>
                                                                            {i + 1}
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-white text-xs font-medium">{inv.name}</p>
                                                                            <p className="text-gray-500 text-[10px]">Score: {inv.score}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs">
                                                                        Active {new Date(inv.lastActive).toLocaleDateString()}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {(analyticsData?.topInvestors || []).length === 0 && (
                                                                <p className="text-gray-500 text-xs italic">No investor activity yet.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Search and Filter */}
                                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                                            <div className="flex-1 relative">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                <input
                                                    type="text"
                                                    placeholder="Search documents..."
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="w-full pl-9 pr-4 py-2.5 sm:py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                                                />
                                            </div>
                                            <select
                                                value={selectedCategory}
                                                onChange={(e) => setSelectedCategory(e.target.value)}
                                                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                                            >
                                                <option value="all">All Categories</option>
                                                {getCategories().map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Documents Grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                                    {filteredDocuments.map(doc => (
                                        <div
                                            key={doc.id}
                                            className={`bg-gray-800 rounded-xl p-4 border transition-colors ${selectedDocuments.has(doc.id)
                                                ? 'border-blue-500 bg-blue-500/10'
                                                : 'border-gray-700 hover:border-gray-600'
                                                }`}
                                        >
                                            <div className="flex items-start gap-3 sm:gap-4">
                                                {/* Selection Checkbox */}
                                                <button
                                                    onClick={() => toggleDocumentSelection(doc.id)}
                                                    className="flex-shrink-0 p-1 touch-manipulation"
                                                >
                                                    {selectedDocuments.has(doc.id) ? (
                                                        <CheckSquare className="w-5 h-5 text-blue-400" />
                                                    ) : (
                                                        <Square className="w-5 h-5 text-gray-400" />
                                                    )}
                                                </button>

                                                <div className="p-2 sm:p-3 bg-gray-700 rounded-lg flex-shrink-0">
                                                    {getFileIcon(doc.name)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold text-white text-sm sm:text-base truncate">{doc.name}</h4>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">
                                                            {doc.category}
                                                        </span>
                                                        <span className="text-xs text-gray-400">{doc.size}</span>
                                                        {doc.versions && doc.versions.length > 1 && (
                                                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                                                                v{doc.versions.length}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="mt-3 pt-3 border-t border-gray-700 space-y-1 text-xs text-gray-400">
                                                        <div className="flex items-center gap-2">
                                                            <Upload className="w-3 h-3 flex-shrink-0" />
                                                            <span className="truncate">Uploaded {formatDate(doc.uploadedAt)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Eye className="w-3 h-3 flex-shrink-0" />
                                                            <span>{doc.accessCount} views</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-700">
                                                <button
                                                    onClick={() => handleViewDocument(doc)}
                                                    className="flex-1 py-2.5 sm:py-2 px-3 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white rounded-lg text-sm flex items-center justify-center gap-2 transition-colors touch-manipulation"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    <span>View</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadDocument(doc)}
                                                    className="flex-1 py-2.5 sm:py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-sm flex items-center justify-center gap-2 transition-colors touch-manipulation"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    <span>Download</span>
                                                </button>
                                                {doc.versions && doc.versions.length > 0 && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedDocument(doc)
                                                            setShowVersionModal(true)
                                                        }}
                                                        className="py-2.5 sm:py-2 px-3 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-lg text-sm flex items-center justify-center gap-2 transition-colors touch-manipulation"
                                                        title="View versions"
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {filteredDocuments.length === 0 && (
                                    <div className="text-center py-12 text-gray-500">
                                        <FileText className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 opacity-50" />
                                        <p className="text-base sm:text-lg">No documents found</p>
                                        <p className="text-xs sm:text-sm mt-1">Try adjusting your search or filter</p>
                                    </div>
                                )}

                                {/* Activity Log */}
                                {selectedRoom.activityLog.length > 0 && (
                                    <div className="mt-4 sm:mt-6 bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-700">
                                        <h3 className="font-semibold text-white mb-4 flex items-center gap-2 text-sm sm:text-base">
                                            <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                                            Recent Activity
                                        </h3>
                                        <div className="space-y-3">
                                            {selectedRoom.activityLog.slice(0, 5).map((log, index) => (
                                                <div key={index} className="flex items-center gap-3 text-xs sm:text-sm">
                                                    <div className={`p-1.5 rounded flex-shrink-0 ${log.action === 'DOWNLOADED' ? 'bg-green-500/20' : 'bg-blue-500/20'}`}>
                                                        {log.action === 'DOWNLOADED' ? (
                                                            <Download className="w-3 h-3 text-green-400" />
                                                        ) : log.action === 'UPLOADED' ? (
                                                            <Upload className="w-3 h-3 text-purple-400" />
                                                        ) : (
                                                            <Eye className="w-3 h-3 text-blue-400" />
                                                        )}
                                                    </div>
                                                    <span className="text-gray-300 truncate flex-1">
                                                        <span className="font-medium text-white">{log.userName}</span> {(log.action || '').toLowerCase()} document
                                                    </span>
                                                    <span className="text-gray-500 hidden sm:inline">•</span>
                                                    <span className="text-gray-400 text-xs whitespace-nowrap">
                                                        {new Date(log.timestamp).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center bg-gray-800 rounded-xl border border-gray-700 min-h-[400px]">
                                <div className="text-center text-gray-500 p-4">
                                    <FolderLock className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 opacity-50" />
                                    <p className="text-base sm:text-lg">Select a data room to view documents</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Upload Modal with Drag & Drop */}
                {showUploadModal && (
                    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                        <div className="bg-gray-800 rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-md border-t sm:border border-gray-700 max-h-[90vh] overflow-y-auto">
                            <h3 className="text-lg sm:text-xl font-semibold text-white mb-4">Upload Document</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Document Name</label>
                                    <input
                                        type="text"
                                        value={uploadForm.name}
                                        onChange={(e) => setUploadForm(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g., Financial Statements Q4 2024"
                                        className="w-full px-4 py-3 sm:py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base touch-manipulation"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                                    <select
                                        value={uploadForm.category}
                                        onChange={(e) => setUploadForm(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full px-4 py-3 sm:py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base touch-manipulation"
                                    >
                                        <option value="General">General</option>
                                        <option value="Financials">Financials</option>
                                        <option value="Legal">Legal</option>
                                        <option value="Strategy">Strategy</option>
                                        <option value="Overview">Overview</option>
                                        <option value="Technical">Technical</option>
                                    </select>
                                </div>

                                {/* Drag & Drop Zone */}
                                <div
                                    ref={dropZoneRef}
                                    onDragEnter={handleDragEnter}
                                    onDragLeave={handleDragLeave}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`p-8 sm:p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors touch-manipulation ${isDragging
                                        ? 'border-blue-500 bg-blue-500/10'
                                        : 'border-gray-600 hover:border-gray-500'
                                        }`}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                                        accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                                        className="hidden"
                                    />
                                    <Upload className="w-10 h-10 sm:w-8 sm:h-8 mx-auto text-gray-400 mb-3 sm:mb-2" />
                                    {uploadForm.file ? (
                                        <div>
                                            <p className="text-sm text-white font-medium">{uploadForm.file.name}</p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {(uploadForm.file.size / 1024 / 1024).toFixed(2)} MB
                                            </p>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-sm text-gray-400">Drag and drop or click to upload</p>
                                            <p className="text-xs text-gray-500 mt-1">PDF, DOCX, XLSX, PNG, JPG up to 10MB</p>
                                        </div>
                                    )}
                                </div>

                                {/* Upload Progress */}
                                {isUploading && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm text-gray-400">
                                            <span>Uploading...</span>
                                            <span>{uploadProgress}%</span>
                                        </div>
                                        <div className="w-full bg-gray-700 rounded-full h-2">
                                            <div
                                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowUploadModal(false)
                                        setUploadForm({ name: '', category: 'General', file: null })
                                    }}
                                    disabled={isUploading}
                                    className="flex-1 py-3 sm:py-2 px-4 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white rounded-lg transition-colors touch-manipulation disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUploadDocument}
                                    disabled={!uploadForm.name || !uploadForm.file || isUploading}
                                    className="flex-1 py-3 sm:py-2 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors touch-manipulation"
                                >
                                    {isUploading ? 'Uploading...' : 'Upload'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* PDF Preview Modal */}
                {showPreviewModal && previewDocument && (
                    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-800 rounded-xl w-full max-w-4xl h-[90vh] flex flex-col border border-gray-700">
                            <div className="flex items-center justify-between p-4 border-b border-gray-700">
                                <h3 className="text-lg font-semibold text-white truncate flex-1">{previewDocument.name}</h3>
                                <button
                                    onClick={() => {
                                        setShowPreviewModal(false)
                                        setPreviewDocument(null)
                                    }}
                                    className="p-2 hover:bg-gray-700 rounded-lg touch-manipulation"
                                >
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-900">
                                <div className="text-center text-gray-400">
                                    <ZoomIn className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg">PDF Preview</p>
                                    <p className="text-sm mt-2">Preview functionality would display the document here</p>
                                    <button
                                        onClick={() => handleDownloadDocument(previewDocument)}
                                        className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 mx-auto touch-manipulation"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download Document
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Version History Modal */}
                {showVersionModal && selectedDocument && (
                    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                        <div className="bg-gray-800 rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-md border-t sm:border border-gray-700 max-h-[90vh] overflow-y-auto">
                            <h3 className="text-lg sm:text-xl font-semibold text-white mb-4">Version History</h3>
                            <p className="text-sm text-gray-400 mb-4">{selectedDocument.name}</p>

                            <div className="space-y-3">
                                {selectedDocument.versions?.map((version, index) => (
                                    <div key={index} className="bg-gray-700 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-white font-medium">Version {version.version}</span>
                                            {index === 0 && (
                                                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-400 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3 h-3" />
                                                <span>{formatDate(version.uploadedAt)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <User className="w-3 h-3" />
                                                <span>{version.uploadedBy}</span>
                                            </div>
                                        </div>
                                        {index !== 0 && (
                                            <button className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm touch-manipulation">
                                                Restore This Version
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => {
                                    setShowVersionModal(false)
                                    setSelectedDocument(null)
                                }}
                                className="w-full mt-4 py-3 sm:py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg touch-manipulation"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}

                {/* Permissions Modal */}
                {showPermissionsModal && selectedRoom && (
                    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                        <div className="bg-gray-800 rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-md border-t sm:border border-gray-700 max-h-[90vh] overflow-y-auto">
                            <h3 className="text-lg sm:text-xl font-semibold text-white mb-4">Manage Permissions</h3>
                            <p className="text-sm text-gray-400 mb-4">{selectedRoom.name}</p>

                            <div className="space-y-3 mb-6">
                                <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Users className="w-5 h-5 text-blue-400" />
                                        <div>
                                            <p className="text-white text-sm font-medium">All Users</p>
                                            <p className="text-gray-400 text-xs">View & Download</p>
                                        </div>
                                    </div>
                                    <button className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-xs touch-manipulation">
                                        Revoke
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Shield className="w-5 h-5 text-green-400" />
                                        <div>
                                            <p className="text-white text-sm font-medium">Admins</p>
                                            <p className="text-gray-400 text-xs">Full Access</p>
                                        </div>
                                    </div>
                                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                                        Active
                                    </span>
                                </div>
                            </div>

                            <button className="w-full py-3 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg mb-3 touch-manipulation">
                                Add User
                            </button>

                            <button
                                onClick={() => setShowPermissionsModal(false)}
                                className="w-full py-3 sm:py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg touch-manipulation"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <style jsx global>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .touch-manipulation {
                    touch-action: manipulation;
                }
            `}</style>
        </DashboardLayout>
    )
}
