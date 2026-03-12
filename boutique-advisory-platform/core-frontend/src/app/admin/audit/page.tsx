'use client'

import { useState, useEffect } from 'react'
import {
    History,
    Search,
    Filter,
    ShieldAlert,
    ShieldCheck,
    User,
    Clock,
    Download,
    Eye,
    ChevronDown,
    Activity,
    AlertCircle
} from 'lucide-react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authorizedRequest } from '../../../lib/api'
import { useToast } from '../../../contexts/ToastContext'

export default function AuditLogPage() {
    const { addToast } = useToast()
    const [logs, setLogs] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        fetchLogs()
    }, [])

    const fetchLogs = async () => {
        setIsLoading(true)
        try {
            const response = await authorizedRequest('/api/audit')
            if (response.ok) {
                const data = await response.json()
                setLogs(data.logs || [])
            }
        } catch (error) {
            console.error('Error fetching logs:', error)
            addToast('error', 'Failed to load audit logs')
        } finally {
            setIsLoading(false)
        }
    }

    const filteredLogs = logs.filter(l =>
        (l.userId + ' ' + l.permission + ' ' + l.reason).toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <History className="w-8 h-8 text-purple-400" />
                            System Audit Logs
                        </h1>
                        <p className="text-gray-400 mt-1">Real-time tracking of security and authorization events.</p>
                    </div>
                    <button className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-all">
                        <Download className="w-5 h-5" />
                        Export Logs (CSV)
                    </button>
                </div>

                {/* Log Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 flex items-center gap-4">
                        <div className="bg-blue-500/10 p-4 rounded-xl">
                            <Activity className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Total Events</p>
                            <p className="text-2xl font-bold text-white">{logs.length}</p>
                        </div>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 flex items-center gap-4">
                        <div className="bg-red-500/10 p-4 rounded-xl">
                            <ShieldAlert className="w-6 h-6 text-red-400" />
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Denied Attempts</p>
                            <p className="text-2xl font-bold text-white">{logs.filter(l => l.result === 'denied').length}</p>
                        </div>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 flex items-center gap-4">
                        <div className="bg-green-500/10 p-4 rounded-xl">
                            <ShieldCheck className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Allowed Events</p>
                            <p className="text-2xl font-bold text-white">{logs.filter(l => l.result === 'allowed').length}</p>
                        </div>
                    </div>
                </div>

                {/* Filter & Search */}
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Filter by user, action or reason..."
                            className="w-full bg-gray-900 border-gray-700 rounded-xl pl-10 text-white focus:ring-purple-500"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-4">
                        <button className="bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-gray-800 group">
                            <Filter className="w-5 h-5 text-gray-500 group-hover:text-purple-400" />
                            <span className="text-sm font-medium">All Results</span>
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Timeline Visualizer */}
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                    <div className="space-y-6">
                        {isLoading ? (
                            <div className="p-12 text-center text-gray-500">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                                Fetching security timeline...
                            </div>
                        ) : filteredLogs.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                No audit events recorded yet.
                            </div>
                        ) : (
                            filteredLogs.map((log, i) => (
                                <div key={i} className={`relative pl-8 pb-6 border-l-2 ${log.result === 'denied' ? 'border-red-500/30' : 'border-blue-500/20'
                                    } last:pb-0 group`}>
                                    <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 bg-gray-800 ${log.result === 'denied' ? 'border-red-500 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'border-blue-500 text-blue-500'
                                        }`}>
                                        <div className="w-full h-full rounded-full animate-pulse-slow bg-current opacity-20" />
                                    </div>

                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 p-4 bg-gray-900/40 border border-gray-700/50 rounded-2xl hover:bg-gray-900/60 hover:border-gray-600 transition-all">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${log.result === 'denied' ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'
                                                    }`}>
                                                    {log.result === 'denied' ? 'Security Violation' : 'Access Granted'}
                                                </span>
                                                <span className="text-sm font-mono text-purple-400">{log.permission}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                                    <User className="w-4 h-4 text-gray-500" />
                                                    <span className="font-medium">{log.userRole}:</span>
                                                    <span className="text-gray-400 font-mono text-xs">{log.userId}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                                    <Clock className="w-4 h-4 text-gray-500" />
                                                    <span className="text-gray-400">{new Date(log.timestamp).toLocaleTimeString()} · {new Date(log.timestamp).toLocaleDateString()}</span>
                                                </div>
                                                {log.ipAddress && (
                                                    <div className="text-xs text-gray-500 font-mono">
                                                        IP: {log.ipAddress.replace('::ffff:', '')}
                                                    </div>
                                                )}
                                            </div>
                                            {log.reason && (
                                                <p className={`text-sm mt-2 flex items-center gap-2 ${log.result === 'denied' ? 'text-red-400' : 'text-gray-400'
                                                    }`}>
                                                    {log.result === 'denied' && <AlertCircle className="w-4 h-4" />}
                                                    {log.reason}
                                                </p>
                                            )}
                                        </div>
                                        <button className="self-end md:self-start opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-gray-800 border border-gray-700 rounded-xl hover:text-purple-400">
                                            <Eye className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
