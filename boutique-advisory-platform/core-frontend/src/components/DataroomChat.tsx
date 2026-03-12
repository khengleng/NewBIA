'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Send, Sparkles, X, Plus } from 'lucide-react'
import { authorizedRequest } from '../lib/api'

interface DataroomChatProps {
    dealId: string
    onClose?: () => void
}

export default function DataroomChat({ dealId, onClose }: DataroomChatProps) {
    const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([
        { role: 'ai', content: "Hello! I'm your Data Room Assistant. I can help you find information across all uploaded documents for this deal. What would you like to know?" }
    ])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMessage = input.trim()
        setInput('')
        setMessages(prev => [...prev, { role: 'user', content: userMessage }])
        setIsLoading(true)

        try {
            const response = await authorizedRequest(`/api/ai/chat/${dealId}`, {
                method: 'POST',
                body: JSON.stringify({ query: userMessage })
            })

            if (response.ok) {
                const data = await response.json()
                setMessages(prev => [...prev, { role: 'ai', content: data.answer }])
            } else {
                setMessages(prev => [...prev, { role: 'ai', content: "I'm sorry, I encountered an error processing your request. Please try again." }])
            }
        } catch (error) {
            setMessages(prev => [...prev, { role: 'ai', content: "I'm having trouble connecting. Please check your internet." }])
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl flex flex-col h-[600px] shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-gray-900/50 rounded-t-2xl">
                <div className="flex items-center gap-2">
                    <div className="bg-purple-600 p-1.5 rounded-lg">
                        <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-white font-bold">Dataroom AI Assistant</h3>
                </div>
                {onClose && (
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-4 ${msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-gray-700 text-gray-200 rounded-bl-none border border-gray-600'
                            }`}>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-700 rounded-2xl p-4 rounded-bl-none border border-gray-600 flex gap-1">
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-75"></div>
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150"></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-700">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask about financials, legal docs, team..."
                        className="w-full bg-gray-900 border-gray-700 rounded-xl pl-4 pr-12 py-3 text-white placeholder-gray-500 focus:ring-purple-500 focus:border-purple-500"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 rounded-lg text-white transition-all"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-[10px] text-gray-500 text-center mt-2 font-mono">POWERED BY GOOGLE GEMINI PRO</p>
            </div>
        </div>
    )
}
