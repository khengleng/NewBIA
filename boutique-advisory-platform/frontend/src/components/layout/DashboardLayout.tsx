'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    Building2,
    Users,
    Handshake,
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
    ChevronRight
} from 'lucide-react'
import { useTranslations } from '../../hooks/useTranslations'
import { User } from '../../types'
import { API_URL, authorizedRequest } from '@/lib/api'
import { hasPermission as hasUiPermission } from '@/lib/permissions'
import { IS_TRADING_PLATFORM, isTradingHostname } from '@/lib/platform'
import { isTradingOperatorRole, normalizeRole, TRADING_OPERATOR_ROLES } from '@/lib/roles'
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
    const [isTradingRuntime, setIsTradingRuntime] = useState(IS_TRADING_PLATFORM)
    const normalizedRole = normalizeRole(user?.role)

    useEffect(() => {
        const isTradingPath = Boolean(pathname?.startsWith('/trading') || pathname?.startsWith('/secondary-trading'))
        setIsTradingRuntime(IS_TRADING_PLATFORM || isTradingHostname(window.location.hostname) || isTradingPath)
    }, [pathname])

    useEffect(() => {
        const fetchUser = async () => {
            // Don't fetch if we're on a public page to avoid infinite redirect loops
            if (pathname?.startsWith('/auth/')) {
                setIsLoading(false);
                return;
            }

            const isTradingContext = IS_TRADING_PLATFORM
                || isTradingHostname(window.location.hostname)
                || Boolean(pathname?.startsWith('/trading') || pathname?.startsWith('/secondary-trading'));

            // Optimistic local user is intentionally disabled on trading runtime to avoid stale-role UI.
            if (!isTradingContext) {
                const storedUser = localStorage.getItem('user')
                if (storedUser) {
                    try {
                        setUser(JSON.parse(storedUser))
                        setIsLoading(false)
                    } catch {
                        // Invalid JSON, ignore
                    }
                }
            }

            try {
                // Try to get user from API (checks cookies)
                const response = await authorizedRequest('/api/auth/me')

                if (response.ok) {
                    const data = await response.json()
                    setUser(data.user)
                    localStorage.setItem('user', JSON.stringify(data.user))
                } else {
                    // Session invalid
                    throw new Error('Session invalid')
                }
            } catch (error: any) {
                // Only log unexpected errors, not standard "no session" redirects
                if (error?.message !== 'Session invalid') {
                    console.error('Error fetching user:', error);
                }

                localStorage.removeItem('user')
                // Only redirect if we're not already on the login page
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
        if (!user) return;
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
            // Continue local logout even if backend logout request fails.
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

    const coreNavSections = [
        {
            label: 'Workspace',
            roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
            items: [
                { href: '/dashboard', label: t('navigation.dashboard'), icon: BarChart3, roles: ['ADVISOR', 'INVESTOR', 'SME'] },
                { href: '/calendar', label: 'Calendar', icon: Calendar, roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'] },
                { href: '/messages', label: 'Messages', icon: MessageSquare, roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'] },
                { href: '/dataroom', label: 'Data Room', icon: FolderLock, roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'] },
                { href: '/reports', label: t('navigation.reports'), icon: FileText, roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'] },
                { href: '/analytics', label: t('home.features.analytics.title'), icon: TrendingUp, roles: ['ADMIN', 'ADVISOR', 'INVESTOR'] },
            ]
        },
        {
            label: 'Deals & Network',
            roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
            items: [
                { href: '/smes', label: t('navigation.smes'), icon: Building2, roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'] },
                { href: '/investors', label: t('navigation.investors'), icon: Users, roles: ['ADMIN', 'ADVISOR', 'SME'] },
                { href: '/pipeline', label: t('navigation.deals'), icon: KanbanSquare, roles: ['ADMIN', 'ADVISOR'] },
                { href: '/sme-pipeline', label: t('advisory.pipeline'), icon: ClipboardCheck, roles: ['ADMIN', 'ADVISOR'] },
                { href: '/matchmaking', label: 'AI Matching', icon: Sparkles, roles: ['ADMIN', 'ADVISOR'] },
                { href: '/investor/portfolio', label: 'My Portfolio', icon: Briefcase, roles: ['INVESTOR'] },
            ]
        },
        {
            label: 'Administration',
            roles: ['ADMIN', 'SUPER_ADMIN', 'SUPPORT'],
            items: [
                { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'SUPER_ADMIN'], permission: 'admin.read' },
                { href: '/admin/business-ops', label: 'Business Ops', icon: Briefcase, roles: ['ADMIN', 'SUPER_ADMIN'], permission: 'admin.read' },
                { href: '/admin/billing', label: 'Billing Ops', icon: Wallet, roles: ['ADMIN', 'SUPER_ADMIN'], permission: 'billing.read' },
                { href: '/admin/operations', label: 'Ops Readiness', icon: ShieldCheck, roles: ['ADMIN', 'SUPER_ADMIN', 'SUPPORT'], permission: 'support_ticket.list' },
                { href: '/admin/cases', label: 'Case Management', icon: ClipboardList, roles: ['ADMIN', 'SUPER_ADMIN', 'SUPPORT'], permission: 'case.list' },
                { href: '/admin/onboarding', label: 'Onboarding Ops', icon: ClipboardCheck, roles: ['ADMIN', 'SUPER_ADMIN', 'SUPPORT'], permission: 'onboarding_task.list' },
                { href: '/admin/role-lifecycle', label: 'Role Lifecycle', icon: Shield, roles: ['ADMIN', 'SUPER_ADMIN'], permission: 'role_grant.list' },
                { href: '/admin/deal-ops', label: 'Deal Ops', icon: Briefcase, roles: ['ADMIN', 'SUPER_ADMIN'], permission: 'admin.read' },
                { href: '/admin/advisor-ops', label: 'Advisor Ops', icon: Users, roles: ['ADMIN', 'SUPER_ADMIN'], permission: 'advisor_ops.read' },
                { href: '/admin/investor-ops', label: 'Investor Ops', icon: UsersRound, roles: ['ADMIN', 'SUPER_ADMIN'], permission: 'investor_ops.read' },
                { href: '/admin/reconciliation', label: 'Reconciliation', icon: Wallet, roles: ['ADMIN', 'SUPER_ADMIN'], permission: 'reconciliation.read' },
                { href: '/admin/data-governance', label: 'Data Governance', icon: ShieldCheck, roles: ['ADMIN', 'SUPER_ADMIN'], permission: 'data_governance.read' },
                { href: '/admin/users', label: 'User Management', icon: UserCog, roles: ['ADMIN', 'SUPER_ADMIN'] },
                { href: '/admin/settings/branding', label: 'Platform Branding', icon: Palette, roles: ['ADMIN', 'SUPER_ADMIN'] },
                { href: '/admin/audit', label: 'System Audit', icon: History, roles: ['ADMIN', 'SUPER_ADMIN'] },
            ]
        },
        {
            label: 'Products',
            roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
            items: [
                { href: '/advisory', label: t('navigation.advisory'), icon: Award, roles: ['ADMIN', 'SME', 'INVESTOR'] },
                { href: '/advisory/manage', label: 'Manage Services', icon: Settings, roles: ['ADMIN', 'ADVISOR'] },
                { href: '/syndicates', label: 'Syndicates', icon: UsersRound, roles: ['ADMIN', 'ADVISOR', 'INVESTOR'] },
                { href: '/due-diligence', label: t('advisory.assessment'), icon: Shield, roles: ['ADMIN', 'ADVISOR'] },
                { href: '/community', label: 'Community', icon: MessagesSquare, roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'] },
            ]
        },
        {
            label: 'Security',
            roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
            items: [
                { href: '/settings/sessions', label: 'Manage Sessions', icon: ShieldCheck, roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'] },
            ]
        },
        {
            label: 'Preferences',
            roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
            items: [
                { href: '/settings', label: t('navigation.settings'), icon: Settings, roles: ['ADMIN', 'ADVISOR', 'INVESTOR', 'SME'] },
            ]
        },
    ]

    const isTradingOperator = isTradingOperatorRole(normalizedRole)
        || hasUiPermission(normalizedRole, 'admin.read')
        || hasUiPermission(normalizedRole, 'billing.read')
    const showTradingWidgets = !isTradingRuntime
    const tradingNavSections = isTradingOperator
        ? [
            {
                label: 'Operator',
                roles: [...TRADING_OPERATOR_ROLES],
                items: [
                    { href: '/trading/markets', label: 'Market Monitor', icon: BarChart3, roles: [...TRADING_OPERATOR_ROLES] },
                    { href: '/admin/trading-ops', label: 'Listing Control', icon: ArrowLeftRight, roles: ['ADMIN', 'SUPER_ADMIN', 'COMPLIANCE', 'SUPPORT'] },
                    { href: '/admin/dashboard', label: 'Platform Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'SUPER_ADMIN', 'AUDITOR'] },
                    { href: '/admin/deal-ops', label: 'Deal Operations', icon: Briefcase, roles: ['ADMIN', 'SUPER_ADMIN', 'COMPLIANCE'] },
                    { href: '/admin/investor-ops', label: 'Investor eKYC', icon: UsersRound, roles: ['ADMIN', 'SUPER_ADMIN', 'COMPLIANCE', 'CX'] },
                    { href: '/admin/reconciliation', label: 'Trading Fee & Reconciliation', icon: Wallet, roles: ['ADMIN', 'SUPER_ADMIN', 'FINOPS', 'AUDITOR'] },
                    { href: '/admin/cases', label: 'Case Management', icon: ClipboardList, roles: ['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'CX'] },
                ]
            },
            {
                label: 'Security',
                roles: [...TRADING_OPERATOR_ROLES],
                items: [
                    { href: '/trading/security', label: 'Platform Security', icon: ShieldCheck, roles: [...TRADING_OPERATOR_ROLES] },
                    { href: '/settings/sessions', label: 'Manage Sessions', icon: Shield, roles: [...TRADING_OPERATOR_ROLES] },
                ]
            },
        ]
        : [
            {
                label: 'Trading',
                roles: ['INVESTOR'],
                items: [
                    { href: '/secondary-trading', label: 'Marketplace', icon: ArrowLeftRight, roles: ['INVESTOR'] },
                    { href: '/trading/markets', label: 'Markets', icon: BarChart3, roles: ['INVESTOR'] },
                    { href: '/investor/portfolio', label: 'My Portfolio', icon: Briefcase, roles: ['INVESTOR'] },
                    { href: '/trading/watchlist', label: 'Watchlist', icon: Sparkles, roles: ['INVESTOR'] },
                    { href: '/trading/profile', label: 'Investor Profile', icon: UserCog, roles: ['INVESTOR'] },
                    { href: '/trading/security', label: 'Investor Security', icon: ShieldCheck, roles: ['INVESTOR'] },
                ]
            },
            {
                label: 'Security',
                roles: ['INVESTOR'],
                items: [
                    { href: '/settings/sessions', label: 'Manage Sessions', icon: ShieldCheck, roles: ['INVESTOR'] },
                ]
            },
        ]

    const navSections = isTradingRuntime ? tradingNavSections : coreNavSections;

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
            {/* Mobile Header - Glassmorphism */}
            <div className="md:hidden sticky top-0 z-40 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 p-4 flex justify-between items-center px-6">
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-white text-lg tracking-tight">{isTradingRuntime ? 'CamboBia Trading' : 'BIA Platform'}</span>
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
                        <h1 className="text-xl font-bold text-white">{isTradingRuntime ? 'CamboBia Trading' : 'Boutique Advisory'}</h1>
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
                            {!isTradingRuntime && (normalizedRole === 'SME' || normalizedRole === 'INVESTOR') && (
                                <button
                                    onClick={handleSwitchRole}
                                    className="text-[10px] text-blue-400 hover:text-blue-300 mt-1 flex items-center gap-1 transition-colors"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Switch to {normalizedRole === 'SME' ? 'Investor' : 'SME'}
                                </button>
                            )}
                        </div>
                        {showTradingWidgets && <NotificationCenter />}
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
            {showTradingWidgets && <Chatbot />}
        </div>
    )
}
