'use client'

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

import { authorizedRequest } from '@/lib/api'

interface SocketContextType {
    socket: Socket | null
    isConnected: boolean
    lastNotification: unknown
    sendMessage: (conversationId: string, content: string, type?: string, attachments?: unknown[]) => void
    joinConversation: (conversationId: string) => void
    leaveConversation: (conversationId: string) => void
}

const SocketContext = createContext<SocketContextType | null>(null)

export const useSocketContext = () => {
    const context = useContext(SocketContext)
    if (!context) {
        throw new Error('useSocketContext must be used within a SocketProvider')
    }
    return context
}

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const socketRef = useRef<Socket | null>(null)
    const intentionalDisconnectRef = useRef(false)
    const [isConnected, setIsConnected] = useState(false)
    const [lastNotification, setLastNotification] = useState<unknown>(null)
    const [user, setUser] = useState<{ id: string; role: string } | null>(null)

    useEffect(() => {
        const syncUserFromSession = async () => {
            try {
                const response = await authorizedRequest('/api/auth/me')
                if (!response.ok) {
                    setUser(null)
                    return
                }
                const payload = await response.json()
                const currentUser = payload?.user
                if (!currentUser?.id || !currentUser?.role) {
                    setUser(null)
                    return
                }
                setUser({ id: currentUser.id, role: currentUser.role })
            } catch {
                setUser(null)
            }
        }

        void syncUserFromSession()

        window.addEventListener('storage', syncUserFromSession as EventListener)
        window.addEventListener('auth:changed', syncUserFromSession as EventListener)

        return () => {
            window.removeEventListener('storage', syncUserFromSession as EventListener)
            window.removeEventListener('auth:changed', syncUserFromSession as EventListener)
        }
    }, [])

    useEffect(() => {
        const socketOrigin = typeof window !== 'undefined'
            ? window.location.origin
            : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003')

        const isAuthRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/')
        const isTradingRuntime = false;

        // Enabled for both Core and Trading platforms to support real-time updates.

        if (!user) {
            if (socketRef.current) {
                intentionalDisconnectRef.current = true
                socketRef.current.io.opts.reconnection = false
                socketRef.current.removeAllListeners()
                socketRef.current.disconnect()
                socketRef.current = null
                setIsConnected(false)
            }
            return
        }

        if (isAuthRoute) {
            return
        }

        // Initialize socket connection
        if (!socketRef.current) {
            const socket = io(socketOrigin, {
                path: '/api-proxy/socket.io',
                withCredentials: true,
                transports: ['polling', 'websocket'],
                autoConnect: false,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                auth: {
                    platform: isTradingRuntime ? 'trading' : 'core',
                },
            })

            socketRef.current = socket

            socket.on('connect', () => {

                intentionalDisconnectRef.current = false
                setIsConnected(true)
            })

            socket.on('disconnect', () => {
                if (!intentionalDisconnectRef.current) {

                }
                setIsConnected(false)
            })

            socket.on('connect_error', () => {
                setIsConnected(false)
            })

            socket.on('notification', (notification: unknown) => {

                setLastNotification(notification)
            })

            socket.on('system_alert', () => {})

            socket.connect()
        }

        return () => {
            // cleanup on unmount? 
            // Since this provider is at root, it unmounts only on app close.
            // But if token changes (logout), we disconnect.
        }
    }, [user])

    const sendMessage = (conversationId: string, content: string, type: string = 'TEXT', attachments: unknown[] = []) => {
        if (socketRef.current) {
            socketRef.current.emit('send_message', { conversationId, content, type, attachments })
        }
    }

    const joinConversation = (conversationId: string) => {
        if (socketRef.current) {
            socketRef.current.emit('join_conversation', conversationId)
        }
    }

    const leaveConversation = (conversationId: string) => {
        if (socketRef.current) {
            socketRef.current.emit('leave_conversation', conversationId)
        }
    }

    return (
        <SocketContext.Provider value={{
            socket: socketRef.current,
            isConnected,
            lastNotification,
            sendMessage,
            joinConversation,
            leaveConversation
        }}>
            {children}
        </SocketContext.Provider>
    )
}
