'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
    id: string
    type: ToastType
    message: string
    duration?: number
}

interface ToastContextType {
    toasts: Toast[]
    addToast: (type: ToastType, message: string, duration?: number) => void
    removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, [])

    const addToast = useCallback((type: ToastType, message: string, duration = 8000) => {
        const id = Math.random().toString(36).substring(2, 9)
        setToasts((prev) => [...prev, { id, type, message, duration }])

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id)
            }, duration)
        }
    }, [removeToast])

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`
              flex items-center w-full max-w-sm p-4 rounded-lg shadow dark:text-gray-400 dark:bg-gray-800 border
              ${toast.type === 'success' ? 'border-green-500 bg-green-900/10' : ''}
              ${toast.type === 'error' ? 'border-red-500 bg-red-900/10' : ''}
              ${toast.type === 'warning' ? 'border-yellow-500 bg-yellow-900/10' : ''}
              ${toast.type === 'info' ? 'border-blue-500 bg-blue-900/10' : ''}
            `}
                        role="alert"
                    >
                        <div className={`
              inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg
              ${toast.type === 'success' ? 'text-green-500 bg-green-100 dark:bg-green-800 dark:text-green-200' : ''}
              ${toast.type === 'error' ? 'text-red-500 bg-red-100 dark:bg-red-800 dark:text-red-200' : ''}
              ${toast.type === 'warning' ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-800 dark:text-yellow-200' : ''}
              ${toast.type === 'info' ? 'text-blue-500 bg-blue-100 dark:bg-blue-800 dark:text-blue-200' : ''}
            `}>
                            {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
                            {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
                            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
                            {toast.type === 'info' && <Info className="w-5 h-5" />}
                        </div>
                        <div className="ml-3 text-sm font-normal text-white">{toast.message}</div>
                        <button
                            type="button"
                            className="ml-auto -mx-1.5 -my-1.5 bg-transparent text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700"
                            onClick={() => removeToast(toast.id)}
                            aria-label="Close"
                        >
                            <span className="sr-only">Close</span>
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}
