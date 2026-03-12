'use client'

import { X } from 'lucide-react'
import { useEffect } from 'react'

interface ConfirmDialogProps {
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    onConfirm: () => void
    onCancel: () => void
    type?: 'danger' | 'warning' | 'info' | 'success'
}

export default function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    type = 'info'
}: ConfirmDialogProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [isOpen])

    if (!isOpen) return null

    const getTypeColors = () => {
        switch (type) {
            case 'danger':
                return {
                    bg: 'bg-red-600 hover:bg-red-700',
                    border: 'border-red-500',
                    icon: 'text-red-500'
                }
            case 'warning':
                return {
                    bg: 'bg-yellow-600 hover:bg-yellow-700',
                    border: 'border-yellow-500',
                    icon: 'text-yellow-500'
                }
            case 'success':
                return {
                    bg: 'bg-green-600 hover:bg-green-700',
                    border: 'border-green-500',
                    icon: 'text-green-500'
                }
            default:
                return {
                    bg: 'bg-blue-600 hover:bg-blue-700',
                    border: 'border-blue-500',
                    icon: 'text-blue-500'
                }
        }
    }

    const colors = getTypeColors()

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn"
                onClick={onCancel}
            />

            {/* Dialog */}
            <div className="relative bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full border border-gray-700 animate-slideIn">
                {/* Header */}
                <div className={`px-6 py-4 border-b ${colors.border} border-opacity-20`}>
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-white">{title}</h3>
                        <button
                            onClick={onCancel}
                            className="p-1 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-6">
                    <p className="text-gray-300 text-base leading-relaxed">{message}</p>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 bg-gray-900/50 rounded-b-2xl flex justify-end space-x-3">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-5 py-2.5 ${colors.bg} text-white rounded-lg font-medium transition-colors shadow-lg`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>

            <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
        </div>
    )
}
