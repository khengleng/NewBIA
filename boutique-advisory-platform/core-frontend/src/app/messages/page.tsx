'use client'

import { useState, useEffect, useRef } from 'react'
import {
    MessageSquare,
    Send,
    Search,
    Phone,
    Video,
    MoreVertical,
    Paperclip,
    Image,
    Smile,
    Check,
    CheckCheck,
    Users,
    Building2,
    Clock,
    File,
    Download,
    ExternalLink,
    X,
    Loader2
} from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useToast } from '../../contexts/ToastContext'
import { apiRequest, authorizedRequest } from '../../lib/api'
import { useSocket } from '../../hooks/useSocket'

interface Message {
    id: string
    conversationId: string
    senderId: string
    senderName: string
    senderType: string
    content: string
    type?: 'TEXT' | 'IMAGE' | 'FILE'
    attachments?: { name: string; url: string; type: string; size: number }[]
    read: boolean
    createdAt: string
}

interface Conversation {
    id: string
    participants: string[]
    participantDetails: { id: string; type: string; name: string }[]
    dealId: string | null
    lastMessage: string
    lastMessageAt: string
    unreadCount: { [key: string]: number }
    createdAt: string
}

interface User {
    id: string
    userId: string
    role: string
    firstName: string
    lastName: string
}

export default function MessagesPage() {
    const { addToast } = useToast()
    const [user, setUser] = useState<User | null>(null)
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isSending, setIsSending] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const imageInputRef = useRef<HTMLInputElement>(null)

    const { socket, joinConversation, leaveConversation, sendMessage: socketSendMessage } = useSocket()

    useEffect(() => {
        const userData = localStorage.getItem('user')

        if (!userData) {
            window.location.href = '/auth/login'
            return
        }

        setUser(JSON.parse(userData))
    }, [])

    useEffect(() => {
        if (!user) return

        const fetchConversations = async () => {
            try {
                const response = await authorizedRequest('/api/messages/conversations')

                if (response.ok) {
                    const data = await response.json()
                    setConversations(Array.isArray(data) ? data : [])
                    if (Array.isArray(data) && data.length > 0) {
                        setSelectedConversation(data[0])
                    }
                }
            } catch (error) {
                console.error('Error fetching conversations:', error)
                addToast('error', 'Failed to load conversations')
            } finally {
                setIsLoading(false)
            }
        }

        fetchConversations()
    }, [user, addToast])

    useEffect(() => {
        if (!selectedConversation) return

        const fetchMessages = async () => {
            try {
                const response = await authorizedRequest(`/api/messages/conversations/${selectedConversation.id}`)

                if (response.ok) {
                    const data = await response.json()
                    setMessages(data.messages || [])
                }
            } catch (error) {
                console.error('Error fetching messages:', error)
            }
        }

        fetchMessages()
        joinConversation(selectedConversation.id)

        return () => {
            leaveConversation(selectedConversation.id)
        }
    }, [selectedConversation, joinConversation, leaveConversation])

    // WebSocket listener for new messages
    useEffect(() => {
        if (!socket) return

        const handleNewMessage = (data: Message) => {
            if (data.conversationId === selectedConversation?.id) {
                setMessages(prev => [...prev, data])
            }

            // Update conversation list item and move to top
            setConversations(prev => {
                const existing = prev.find(c => c.id === data.conversationId)
                if (!existing) return prev // Or fetch new list if it's a completely new convo

                const updated = {
                    ...existing,
                    lastMessage: data.type === 'IMAGE' ? '[Image]' : (data.type === 'FILE' ? `[File]` : data.content),
                    lastMessageAt: data.createdAt
                }

                return [updated, ...prev.filter(c => c.id !== data.conversationId)]
            })
        }

        socket.on('new_message', handleNewMessage)
        return () => {
            socket.off('new_message')
        }
    }, [socket, selectedConversation])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isUploading])

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isImage: boolean = false) => {
        const file = e.target.files?.[0]
        if (!file || !selectedConversation) return

        setIsUploading(true)
        const formData = new FormData()
        formData.append('file', file)

        try {
            const response = await authorizedRequest('/api/messages/upload', {
                method: 'POST',
                body: formData
            })

            if (response.ok) {
                const attachment = await response.json()

                // Now send the message with this attachment
                const msgResponse = await authorizedRequest('/api/messages', {
                    method: 'POST',
                    body: JSON.stringify({
                        conversationId: selectedConversation.id,
                        content: isImage ? '' : `Sent a file: ${file.name}`,
                        type: isImage ? 'IMAGE' : 'FILE',
                        attachments: [attachment]
                    })
                })

                if (msgResponse.ok) {
                    const sentMessage = await msgResponse.json()
                    setMessages(prev => [...prev, sentMessage])

                    // Notify other participants via WebSocket
                    socketSendMessage(
                        selectedConversation.id,
                        isImage ? '[Image]' : `[File: ${file.name}]`,
                        isImage ? 'IMAGE' : 'FILE',
                        [attachment]
                    )

                    // Update conversation list item
                    setConversations(prev => prev.map(c =>
                        c.id === selectedConversation.id
                            ? { ...c, lastMessage: isImage ? 'Sent an image' : `File: ${file.name}`, lastMessageAt: new Date().toISOString() }
                            : c
                    ))
                }
            } else {
                addToast('error', 'Failed to upload file')
            }
        } catch (error) {
            console.error('Error uploading file:', error)
            addToast('error', 'Error uploading file')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
            if (imageInputRef.current) imageInputRef.current.value = ''
        }
    }

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedConversation) return

        setIsSending(true)
        const content = newMessage.trim()
        try {
            const response = await authorizedRequest('/api/messages', {
                method: 'POST',
                body: JSON.stringify({
                    conversationId: selectedConversation.id,
                    content
                })
            })

            if (response.ok) {
                const sentMessage = await response.json()
                setMessages(prev => [...prev, sentMessage])
                setNewMessage('')

                // Notify other participants via WebSocket
                socketSendMessage(selectedConversation.id, content, 'TEXT', [])

                // Update conversation last message locally
                setConversations(prev => prev.map(c =>
                    c.id === selectedConversation.id
                        ? { ...c, lastMessage: content, lastMessageAt: new Date().toISOString() }
                        : c
                ))
            } else {
                addToast('error', 'Failed to send message')
            }
        } catch (error) {
            console.error('Error sending message:', error)
            addToast('error', 'Error sending message')
        } finally {
            setIsSending(false)
        }
    }

    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diff = now.getTime() - date.getTime()

        if (diff < 60000) return 'Just now'
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
        if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        return date.toLocaleDateString()
    }

    const getOtherParticipant = (conv: Conversation) => {
        if (!conv || !conv.participantDetails || !Array.isArray(conv.participantDetails)) {
            return { id: 'unknown', type: 'SME', name: 'Unknown Participant' }
        }
        return conv.participantDetails.find(p => p.id !== user?.id) || conv.participantDetails[0]
    }

    const filteredConversations = (conversations || []).filter(conv => {
        if (!conv) return false
        if (!searchQuery) return true
        const other = getOtherParticipant(conv)
        return (other.name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    })

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
            <div className="h-[calc(100vh-140px)] flex bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                {/* Conversations List */}
                <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-700">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <MessageSquare className="w-6 h-6 text-blue-400" />
                            Messages
                        </h2>
                        <div className="mt-3 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search conversations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Conversations */}
                    <div className="flex-1 overflow-y-auto">
                        {filteredConversations.length === 0 ? (
                            <div className="p-4 text-center text-gray-400">
                                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>No conversations yet</p>
                            </div>
                        ) : (
                            filteredConversations.map(conv => {
                                const other = getOtherParticipant(conv)
                                const isSelected = selectedConversation?.id === conv.id

                                return (
                                    <div
                                        key={conv.id}
                                        onClick={() => setSelectedConversation(conv)}
                                        className={`p-4 cursor-pointer transition-colors border-b border-gray-700 ${isSelected ? 'bg-blue-600/20' : 'hover:bg-gray-700'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${other.type === 'INVESTOR' ? 'bg-blue-500/20' : 'bg-green-500/20'
                                                }`}>
                                                {other.type === 'INVESTOR' ? (
                                                    <Users className="w-6 h-6 text-blue-400" />
                                                ) : (
                                                    <Building2 className="w-6 h-6 text-green-400" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <h3 className="font-semibold text-white truncate">{other.name}</h3>
                                                    <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                                                        {formatTime(conv.lastMessageAt)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-400 truncate mt-1">
                                                    {conv.lastMessage || 'Start a conversation'}
                                                </p>
                                                {conv.dealId && (
                                                    <span className="inline-block mt-1 px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                                                        Deal Related
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col bg-gray-900">
                    {selectedConversation ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getOtherParticipant(selectedConversation).type === 'INVESTOR'
                                        ? 'bg-blue-500/20' : 'bg-green-500/20'
                                        }`}>
                                        {getOtherParticipant(selectedConversation).type === 'INVESTOR' ? (
                                            <Users className="w-5 h-5 text-blue-400" />
                                        ) : (
                                            <Building2 className="w-5 h-5 text-green-400" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">
                                            {getOtherParticipant(selectedConversation).name}
                                        </h3>
                                        <p className="text-xs text-gray-400">
                                            {getOtherParticipant(selectedConversation).type}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                                        <Phone className="w-5 h-5 text-gray-400" />
                                    </button>
                                    <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                                        <Video className="w-5 h-5 text-gray-400" />
                                    </button>
                                    <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                                        <MoreVertical className="w-5 h-5 text-gray-400" />
                                    </button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {messages.map(message => {
                                    const isOwn = message.senderId === user?.id

                                    return (
                                        <div
                                            key={message.id}
                                            className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
                                                {!isOwn && (
                                                    <p className="text-xs text-gray-400 mb-1 px-2">
                                                        {message.senderName}
                                                    </p>
                                                )}
                                                <div className={`px-4 py-2 rounded-2xl ${isOwn
                                                    ? 'bg-blue-600 text-white rounded-br-sm'
                                                    : 'bg-gray-700 text-white rounded-bl-sm'
                                                    }`}>
                                                    {message.type === 'IMAGE' && message.attachments && message.attachments.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {message.attachments.map((att, idx) => (
                                                                <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="block relative group">
                                                                    <img
                                                                        src={att.url}
                                                                        alt={att.name}
                                                                        className="max-w-full rounded-lg border border-white/10 hover:opacity-90 transition-opacity"
                                                                    />
                                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity">
                                                                        <ExternalLink className="w-6 h-6 text-white" />
                                                                    </div>
                                                                </a>
                                                            ))}
                                                            {message.content && <p className="mt-2">{message.content}</p>}
                                                        </div>
                                                    ) : message.type === 'FILE' && message.attachments && message.attachments.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {message.attachments.map((att, idx) => (
                                                                <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl border border-white/10 ${isOwn ? 'bg-blue-700/50' : 'bg-gray-800/50'}`}>
                                                                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                                                                        <File className="w-5 h-5" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-medium truncate">{att.name}</p>
                                                                        <p className="text-[10px] opacity-60">{(att.size / 1024).toFixed(1)} KB</p>
                                                                    </div>
                                                                    <a
                                                                        href={att.url}
                                                                        download
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                                                    >
                                                                        <Download className="w-4 h-4" />
                                                                    </a>
                                                                </div>
                                                            ))}
                                                            {message.content && <p className="mt-2 text-sm">{message.content}</p>}
                                                        </div>
                                                    ) : (
                                                        <p>{message.content}</p>
                                                    )}
                                                </div>
                                                <div className={`flex items-center gap-1 mt-1 px-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                                    <span className="text-xs text-gray-500">
                                                        {formatTime(message.createdAt)}
                                                    </span>
                                                    {isOwn && (
                                                        message.read ? (
                                                            <CheckCheck className="w-3 h-3 text-blue-400" />
                                                        ) : (
                                                            <Check className="w-3 h-3 text-gray-400" />
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                {isUploading && (
                                    <div className="flex justify-end">
                                        <div className="bg-blue-600/20 px-4 py-2 rounded-2xl flex items-center gap-3">
                                            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                                            <span className="text-xs text-blue-400 font-medium tracking-wide">Uploading file...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-4 border-t border-gray-700 bg-gray-800">
                                {/* Hidden Inputs */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={(e) => handleFileUpload(e, false)}
                                />
                                <input
                                    type="file"
                                    ref={imageInputRef}
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleFileUpload(e, true)}
                                />

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                                        title="Attach file"
                                    >
                                        <Paperclip className="w-5 h-5 text-gray-400" />
                                    </button>
                                    <button
                                        onClick={() => imageInputRef.current?.click()}
                                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                                        title="Attach image"
                                    >
                                        <Image className="w-5 h-5 text-gray-400" />
                                    </button>
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                            placeholder="Type a message..."
                                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <button className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                            <Smile className="w-5 h-5 text-gray-400 hover:text-yellow-400 transition-colors" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!newMessage.trim() || isSending}
                                        className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                                    >
                                        {isSending ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        ) : (
                                            <Send className="w-5 h-5 text-white" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center text-gray-400">
                                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p className="text-lg">Select a conversation to start messaging</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}
