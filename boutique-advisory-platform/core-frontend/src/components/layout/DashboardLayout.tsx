'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    Building2,
    Users,
    BarChart3,
    ClipboardCheck,
    FileText,
    Settings,
    LogOut,
    Award,
    Menu,
    X,
    Sparkles,
    MessageSquare,
    KanbanSquare,
    FolderLock,
    TrendingUp,
    Calendar,
    Shield,
    ShieldCheck,
    // New feature icons
    UsersRound,
    MessagesSquare,
    ArrowLeftRight,
    LayoutDashboard,
    UserCog,
    History,
    Briefcase,
    Palette,
    RefreshCw,
    Wallet,
    ClipboardList,
    ChevronDown,
    ChevronRight,
    Rocket
} from 'lucide-react'
import { useTranslations } from '../../hooks/useTranslations'
import { User } from '../../types'
import { authorizedRequest } from '@/lib/api'
import { hasPermission as hasUiPermission } from '@/lib/permissions'
import { isCoreHostname, CORE_FRONTEND_URL } from '@/lib/platform'
import { normalizeRole } from '@/lib/roles'
import NotificationCenter from '../NotificationCenter'
import LanguageSwitcher from '../LanguageSwitcher'
import Chatbot from '../Chatbot'

interface DashboardLayoutProps {
    children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const router = useRouter()
    const pathname = usePathname()
    const { t } = useTranslations()
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
    const normalizedRole = normalizeRole(user?.role)
    const canSwitchPersona = (normalizedRole === 'SME' || normalizedRole === 'INVESTOR')

    useEffect(() => {
        const fetchUser = async () => {
            if (pathname?.startsWith('/auth/')) {
                setIsLoading(false);
                return;
            }

            try {
                const response = await authorizedRequest('/api/auth/me')
                if (response.ok) {
                    const data = await response.json()
                    setUser(data.user)
                    localStorage.setItem('user', JSON.stringify(data.user))
                } else {
                    throw new Error('Session invalid')
                }
            } catch (error: any) {
                if (error?.message !== 'Session invalid') {
                    console.error('Error fetching user:', error);
                }
                localStorage.removeItem('user')
                if (pathname !== '/auth/login' && pathname !== '/auth/register') {
                    router.push('/auth/login')
                }
            } finally {
                setIsLoading(false)
            }
        }
        fetchUser()
    }, [router, pathname])

    const handleSwitchRole = async () => {
        if (!user || !canSwitchPersona) return;
        const targetRole = normalizedRole === 'SME' ? 'INVESTOR' : 'SME';
        try {
            const response = await authorizedRequest('/api/auth/switch-role', {
                method: 'POST',
                body: JSON.stringify({ targetRole })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('user', JSON.stringify(data.user));
                setUser(data.user);
                window.location.reload();
            }
        } catch (error) {
            console.error('Failed to switch role', error);
        }
    }

    const handleLogout = async () => {
        try {
            await authorizedRequest('/api/auth/logout', { method: 'POST' })
        } catch (error) {
            console.error('Logout API failed, continuing with local logout:', error)
        } finally {
            localStorage.removeItem('user')
            setUser(null)
            window.dispatchEvent(new Event('auth:changed'))
            router.replace('/auth/login')
        }
    }

    const isActive = (path: string) => {
        return pathname === path || pathname?.startsWith(`${path}/`)
    }

    const navSections = [
        {
            label: 'Workspace',
            roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
            items: [
                { href: '/dashboard', label: t('navigation.dashboard'), icon: BarChart3, roles: ['ADVISOR', 'INVESTOR', 'SME'] },
                { href: '/calendar', label: 'Calendar', icon: Calendar, roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'] },
                { href: '/messages', label: 'Messages', icon: MessageSquare, roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'] },
                { href: '/reports', label: t('navigation.reports'), icon: FileText, roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'] },
            ]
        },
        {
            label: 'SME Workspace',
            roles: ['SME'],
            items: [
                { href: '/smes', label: 'My Business', icon: Building2, roles: ['SME'] },
                { href: '/deals', label: 'Fundraising', icon: Briefcase, roles: ['SME'] },
                { href: '/investors', label: 'Investor Network', icon: Users, roles: ['SME'] },
                { href: '/dataroom', label: 'Data Room', icon: FolderLock, roles: ['SME'] },
                { href: '/documents', label: 'Documents', icon: FileText, roles: ['SME'] },
                { href: '/advisory', label: 'Advisory Support', icon: Award, roles: ['SME'] },
                { href: '/payments', label: 'Payments', icon: Wallet, roles: ['SME'] },
            ]
        },
        {
            label: 'Investor Workspace',
            roles: ['INVESTOR'],
            items: [
                { href: '/smes', label: 'SME Listings', icon: Building2, roles: ['INVESTOR'] },
                { href: '/investor/portfolio', label: 'My Portfolio', icon: Briefcase, roles: ['INVESTOR'] },
                { href: '/syndicates', label: 'Syndicates', icon: UsersRound, roles: ['INVESTOR'] },
                { href: '/advisory', label: t('navigation.advisory'), icon: Award, roles: ['INVESTOR'] },
                { href: '/wallet', label: 'My Wallet', icon: Wallet, roles: ['INVESTOR'] },
            ]
        },
        {
            label: 'Advisor Workspace',
            roles: ['ADVISOR'],
            items: [
                { href: '/smes', label: t('navigation.smes'), icon: Building2, roles: ['ADVISOR'] },
                { href: '/investors', label: t('navigation.investors'), icon: Users, roles: ['ADVISOR'] },
                { href: '/pipeline', label: t('navigation.deals'), icon: KanbanSquare, roles: ['ADVISOR'] },
                { href: '/sme-pipeline', label: t('advisory.pipeline'), icon: ClipboardCheck, roles: ['ADVISOR'] },
                { href: '/matchmaking', label: 'AI Matching', icon: Sparkles, roles: ['ADVISOR'] },
                { href: '/dataroom', label: 'Data Room', icon: FolderLock, roles: ['ADVISOR'] },
                { href: '/advisory/manage', label: 'Manage Services', icon: Settings, roles: ['ADVISOR'] },
            ]
        },
        {
            label: 'Platform Admin',
            roles: ['SUPER_ADMIN', 'ADMIN'],
            items: [
                { href: '/admin/dashboard', label: 'Control Tower', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN'], permission: 'admin.read' },
                { href: '/admin/users', label: 'User Management', icon: UserCog, roles: ['ADMIN', 'SUPER_ADMIN'] },
                { href: '/settings', label: 'Account Security', icon: ShieldCheck, roles: ['SUPER_ADMIN', 'ADMIN'] },
                { href: '/admin/role-lifecycle', label: 'Role Lifecycle', icon: Shield, roles: ['SUPER_ADMIN', 'ADMIN'], permission: 'role_grant.list' },
                { href: '/admin/audit', label: 'System Audit', icon: History, roles: ['SUPER_ADMIN', 'ADMIN'] },
                { href: '/admin/bot', label: 'Telegram Management', icon: MessagesSquare, roles: ['SUPER_ADMIN', 'ADMIN'] },
            ]
        },
        {
            label: 'Products',
            roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
            items: [
                { href: '/advisory', label: t('navigation.advisory'), icon: Award, roles: ['ADMIN'] },
                { href: '/advisory/manage', label: 'Manage Services', icon: Settings, roles: ['ADMIN'] },
                { href: '/syndicates', label: 'Syndicates', icon: UsersRound, roles: ['ADMIN', 'ADVISOR'] },
                { href: '/due-diligence', label: t('advisory.assessment'), icon: Shield, roles: ['ADMIN', 'ADVISOR'] },
                { href: '/community', label: 'Community', icon: MessagesSquare, roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'] },
            ]
        },
        {
            label: 'Preferences',
            roles: ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
            items: [
                { href: '/settings', label: t('navigation.settings'), icon: Settings, roles: ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR', 'SME'] },
            ]
        },
    ]

    const filteredNavSections = navSections.map((section: any) => {
        if (!user) return null
        if (section.roles && !section.roles.includes(normalizedRole)) return null

        const items = section.items.filter((item: any) => {
            if (item.permission && !hasUiPermission(normalizedRole, item.permission)) return false
            if (!item.roles) return true
            return item.roles.includes(normalizedRole)
        })

        if (items.length === 0) return null
        return { label: section.label, items }
    }).filter(Boolean)

    useEffect(() => {
        setCollapsedSections((prev) => {
            let changed = false
            const next = { ...prev }
            for (const section of filteredNavSections as any[]) {
                if (!(section.label in next)) {
                    next[section.label] = false
                    changed = true
                }
            }
            return changed ? next : prev
        })
    }, [filteredNavSections])

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col md:flex-row">
            {/* Mobile Header */}
            <div className="md:hidden sticky top-0 z-40 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 p-4 flex justify-between items-center px-6">
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-white text-lg tracking-tight">CamboBia Platform</span>
                </div>
                <div className="flex items-center space-x-3">
                    <LanguageSwitcher />
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="text-gray-400 hover:text-white p-1"
                    >
                        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* Sidebar */}
            <aside
                className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:min-h-screen
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
            >
                <div className="hidden md:flex items-center justify-between p-6 border-b border-gray-700">
                    <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-xl font-bold text-white">CamboBia Platform</h1>
                    </div>
                    <LanguageSwitcher />
                </div>

                <nav className="flex-1 px-4 py-6 overflow-y-auto">
                    <div className="space-y-5">
                        {filteredNavSections.map((section: any) => (
                            <div key={section.label}>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCollapsedSections((prev) => ({
                                            ...prev,
                                            [section.label]: !prev[section.label]
                                        }))
                                    }
                                    className="w-full text-[11px] text-gray-500 px-4 mb-2 uppercase tracking-wide font-semibold flex items-center justify-between hover:text-gray-300"
                                >
                                    <span>{section.label}</span>
                                    {collapsedSections[section.label] ? (
                                        <ChevronRight className="w-3 h-3" />
                                    ) : (
                                        <ChevronDown className="w-3 h-3" />
                                    )}
                                </button>
                                {!collapsedSections[section.label] && (
                                    <div className="space-y-1">
                                        {section.items.map((item: any) => {
                                            const Icon = item.icon
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className={`flex items-center px-4 py-2 rounded-lg transition-colors ${isActive(item.href)
                                                        ? 'bg-blue-600 text-white'
                                                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                                        }`}
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                >
                                                    {Icon && <Icon className="w-5 h-5 mr-3" />}
                                                    <span className="flex-1">{item.label}</span>
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </nav>

                <div className="p-4 border-t border-gray-700">
                    <div className="flex items-center mb-4 px-4">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                                {user?.firstName} {user?.lastName}
                            </p>
                            <p className="text-xs text-gray-400 capitalize truncate">
                                {normalizedRole.toLowerCase()}
                            </p>
                            {canSwitchPersona && (
                                <button
                                    onClick={handleSwitchRole}
                                    className="text-[10px] text-blue-400 hover:text-blue-300 mt-1 flex items-center gap-1 transition-colors"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Switch to {normalizedRole === 'SME' ? 'Investor' : 'SME'}
                                </button>
                            )}
                        </div>
                        <NotificationCenter />
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-red-400 hover:text-white hover:bg-red-600 rounded-lg transition-colors"
                    >
                        <LogOut className="w-5 h-5 mr-3" />
                        {t('navigation.logout')}
                    </button>
                </div>
            </aside>

            {/* Overlay for mobile */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                ></div>
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden pb-24 md:pb-0">
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    {children}
                </div>
            </main>

            {/* AI Chatbot Widget */}
            <Chatbot />
        </div>
    )
}
