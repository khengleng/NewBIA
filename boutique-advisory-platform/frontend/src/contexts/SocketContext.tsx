'use client'

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { resolveTradingRuntime } from '@/lib/platform'

interface SocketContextType {
    socket: Socket | null
    isConnected: boolean
    lastNotification: any
    sendMessage: (conversationId: string, content: string, type?: string, attachments?: any[]) => void
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
    const [lastNotification, setLastNotification] = useState<any>(null)
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        const syncUserFromStorage = () => {
            const storedUser = localStorage.getItem('user')
            if (storedUser) {
                try {
                    setUser(JSON.parse(storedUser))
                } catch {
                    setUser(null)
                }
            } else {
                setUser(null)
            }
        }

        // Initial user check
        syncUserFromStorage()

        // Listen for storage events (login/logout from other tabs)
        window.addEventListener('storage', syncUserFromStorage)
        // Listen for same-tab auth changes
        window.addEventListener('auth:changed', syncUserFromStorage)

        return () => {
            window.removeEventListener('storage', syncUserFromStorage)
            window.removeEventListener('auth:changed', syncUserFromStorage)
        }
    }, [])

    useEffect(() => {
        const socketOrigin = typeof window !== 'undefined'
            ? window.location.origin
            : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003')

        const isAuthRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/')
        const isTradingContext = typeof window !== 'undefined'
            && resolveTradingRuntime(window.location.hostname, window.location.pathname)

        // Enabled for both Core and Trading platforms to support real-time market/notification updates

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
                transports: ['websocket', 'polling'],
                autoConnect: false,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
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

            socket.on('connect_error', (error) => {
                if (!intentionalDisconnectRef.current) {

                }
            })

            socket.on('notification', (notification) => {

                setLastNotification(notification)
            })

            socket.on('system_alert', (alert) => {

            })

            socket.connect()
        }

        return () => {
            // cleanup on unmount? 
            // Since this provider is at root, it unmounts only on app close.
            // But if token changes (logout), we disconnect.
        }
    }, [user])

    const sendMessage = (conversationId: string, content: string, type: string = 'TEXT', attachments: any[] = []) => {
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
