
// BIA Assistant v1.1 - Animated Superman Icon
'use client'

import React, { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, Bot, User as UserIcon, Loader2 } from 'lucide-react'
import { authorizedRequest } from '../lib/api'

interface Message {
    id: string
    text: string
    sender: 'user' | 'bot'
    timestamp: Date
}

const SupermanIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
    >
        <path d="M12 2L4 7v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V7l-8-5zm0 2.18l6 3.89v4.93c0 4.54-3.13 8.78-6 9.88-2.87-1.1-6-5.34-6-9.88V8.07l6-3.89z" />
        <path d="M10 10h4v2h-4v2h4v2h-4v2h4c1.1 0 2-.9 2-2v-2c0-1.1-.9-2-2-2h-4v-2h4V8h-4c-1.1 0-2 .9-2 2v2z" transform="scale(0.8) translate(3,3)" />
    </svg>
)

export default function Chatbot() {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            text: 'Hello! I am your AI Assistant. You can ask me about investors, SMEs, or general platform information. How can I help you today?',
            sender: 'bot',
            timestamp: new Date()
        }
    ])
    const [inputValue, setInputValue] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages, isOpen])

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault()

        if (!inputValue.trim()) return

        const userMessage: Message = {
            id: Date.now().toString(),
            text: inputValue,
            sender: 'user',
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setInputValue('')
        setIsLoading(true)

        const currentLanguage = localStorage.getItem('selectedLanguage') || 'en'

        try {
            const response = await authorizedRequest('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage.text,
                    language: currentLanguage
                })
            })

            const data = await response.json().catch(() => ({}))

            if (!response.ok) {
                const friendlyError =
                    response.status === 401 ? 'Your session expired. Please sign in again.' :
                    response.status === 403 ? 'Your account is not allowed to use AI chat.' :
                    response.status === 404 ? 'AI chat is not available right now on this environment.' :
                    response.status >= 500 ? 'AI service is temporarily unavailable. Please try again shortly.' :
                    'Unable to reach AI chat right now.'

                const botErrorMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    text: data?.error || friendlyError,
                    sender: 'bot',
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, botErrorMessage])
                return
            }

            const botMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: data.error || data.response || "I'm sorry, I couldn't process that request.",
                sender: 'bot',
                timestamp: new Date()
            }

            setMessages(prev => [...prev, botMessage])
        } catch (error) {
            console.error('Chat error:', error)
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: "Sorry, I encountered an error connecting to the AI service. Please try again later.",
                sender: 'bot',
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
        } finally {
            setIsLoading(false)
        }
    }

    if (!isOpen) {
        return (
            <div className="fixed bottom-24 sm:bottom-6 right-6 z-50 group">
                {/* Pulsing ring effect */}
                <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-25 group-hover:opacity-0 transition-opacity"></div>

                <button
                    onClick={() => setIsOpen(true)}
                    className="relative p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 hover:scale-110 transition-all duration-300 flex items-center justify-center animate-bounce-subtle"
                    aria-label="Open AI Chat"
                    style={{
                        animation: 'float 3s ease-in-out infinite'
                    }}
                >
                    <SupermanIcon className="w-6 h-6" />

                    {/* Style block for custom float animation */}
                    <style jsx>{`
                        @keyframes float {
                            0% { transform: translateY(0px); }
                            50% { transform: translateY(-10px); }
                            100% { transform: translateY(0px); }
                        }
                    `}</style>
                </button>
            </div>
        )
    }

    return (
        <div className="fixed bottom-24 sm:bottom-6 right-6 w-96 max-w-[calc(100vw-2rem)] h-[500px] max-h-[80vh] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <SupermanIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-white font-medium">BIA Assistant</h3>
                        <p className="text-xs text-gray-400">Powered by Claude AI</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`
                                max-w-[80%] p-3 rounded-lg text-sm
                                ${msg.sender === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-none'
                                    : 'bg-gray-800 text-gray-200 rounded-bl-none border border-gray-700'}
                            `}
                        >
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            <span className="text-[10px] opacity-50 block mt-1">
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg rounded-bl-none flex items-center space-x-2">
                            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                            <span className="text-xs text-gray-400">Thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="bg-gray-800 p-3 border-t border-gray-700 flex items-center space-x-2">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ask about investors, SMEs..."
                    className="flex-1 bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={!inputValue.trim() || isLoading}
                    className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Send className="w-5 h-5" />
                </button>
            </form>
        </div>
    )
}
