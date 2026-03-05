'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Home, Users, FileText, MessageSquare, Settings, ShieldCheck, Briefcase, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IS_TRADING_PLATFORM, resolveTradingRuntime } from '@/lib/platform'
import { isTradingOperatorRole, normalizeRole } from '@/lib/roles'

export default function BottomNavigation() {
    const pathname = usePathname()
    const router = useRouter()
    const [isVisible, setIsVisible] = useState(true)
    const [lastScrollY, setLastScrollY] = useState(0)
    const [role, setRole] = useState('')
    const [isTradingRuntime, setIsTradingRuntime] = useState(IS_TRADING_PLATFORM)

    useEffect(() => {
        setIsTradingRuntime(resolveTradingRuntime(window.location.hostname, pathname || window.location.pathname))

        const loadRole = () => {
            try {
                const stored = localStorage.getItem('user')
                if (!stored) {
                    setRole('')
                    return
                }
                const parsed = JSON.parse(stored)
                setRole(normalizeRole(parsed?.role))
            } catch {
                setRole('')
            }
        }

        loadRole()
        window.addEventListener('auth:changed', loadRole)
        return () => window.removeEventListener('auth:changed', loadRole)
    }, [pathname])

    // Hide/show on scroll
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY

            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                // Scrolling down
                setIsVisible(false)
            } else {
                // Scrolling up
                setIsVisible(true)
            }

            setLastScrollY(currentScrollY)
        }

        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [lastScrollY])

    // Don't show on auth pages
    if (pathname?.startsWith('/auth')) {
        return null
    }

    const isTradingOperator = isTradingOperatorRole(role)

    const navItems = isTradingRuntime
        ? isTradingOperator
            ? [
                { icon: Home, label: 'Markets', path: '/trading/markets' },
                { icon: ShieldCheck, label: 'Ops', path: '/trading/operator/dashboard' },
                { icon: Briefcase, label: 'Deals', path: '/trading/operator/deal-oversight' },
                { icon: Users, label: 'Investors', path: '/trading/operator/investor-kyc' },
                { icon: Settings, label: 'Reconcile', path: '/trading/operator/reconciliation' },
            ]
            : [
                { icon: Home, label: 'Markets', path: '/trading/markets' },
                { icon: Wallet, label: 'Wallet', path: '/trading/wallet' },
                { icon: FileText, label: 'Trade', path: '/secondary-trading' },
                { icon: Users, label: 'Portfolio', path: '/trading/portfolio' },
                { icon: Settings, label: 'Security', path: '/trading/security' },
            ]
        : [
            { icon: Home, label: 'Home', path: '/dashboard' },
            { icon: Users, label: 'Network', path: '/investors' },
            { icon: FileText, label: 'Deals', path: '/deals' },
            { icon: MessageSquare, label: 'Messages', path: '/messages' },
            { icon: Settings, label: 'Settings', path: '/settings' },
        ]

    const handleNavigate = (path: string) => {
        // Haptic feedback
        if ('vibrate' in navigator) {
            navigator.vibrate(30)
        }
        router.push(path)
    }

    return (
        <nav
            className={`
                sm:hidden fixed bottom-0 left-0 right-0 z-50 
                bg-gray-900/95 backdrop-blur-lg border-t border-gray-800
                transition-transform duration-300 ease-in-out
                ${isVisible ? 'translate-y-0' : 'translate-y-full'}
            `}
            style={{
                paddingBottom: 'max(0px, env(safe-area-inset-bottom))'
            }}
        >
            <div className="flex items-center justify-around px-2 py-2">
                {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.path || pathname?.startsWith(item.path)

                    return (
                        <button
                            key={item.path}
                            onClick={() => handleNavigate(item.path)}
                            className={`
                                flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl
                                transition-all duration-200 touch-manipulation min-w-[60px]
                                ${isActive
                                    ? 'bg-blue-600/20 text-blue-400'
                                    : 'text-gray-400 active:bg-gray-800'
                                }
                            `}
                        >
                            <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                            <span className={`text-xs font-medium ${isActive ? 'font-semibold' : ''}`}>
                                {item.label}
                            </span>
                        </button>
                    )
                })}
            </div>
        </nav>
    )
}
