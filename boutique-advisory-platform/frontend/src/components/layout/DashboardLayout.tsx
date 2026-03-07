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
import { IS_TRADING_PLATFORM, resolveTradingRuntime, isTradingHostname, CORE_FRONTEND_URL } from '@/lib/platform'
import { isTradingOperatorRole, normalizeRole, TRADING_OPERATOR_ROLES } from '@/lib/roles'
import { TRADING_OPERATOR_HOME } from '@/lib/tradingOperatorRoutes'
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
    const canSwitchPersona = !isTradingRuntime && (normalizedRole === 'SME' || normalizedRole === 'INVESTOR')

    useEffect(() => {
        setIsTradingRuntime(resolveTradingRuntime(window.location.hostname, pathname || window.location.pathname))
    }, [pathname])

    useEffect(() => {
        const fetchUser = async () => {
            // Don't fetch if we're on a public page to avoid infinite redirect loops
            if (pathname?.startsWith('/auth/')) {
                setIsLoading(false);
                return;
            }

            const isTradingContext = resolveTradingRuntime(window.location.hostname, pathname || window.location.pathname);

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

    const operatorRoles = [...TRADING_OPERATOR_ROLES]
    const coreNavSections = [
        {
            label: 'Exchange & Trading',
            roles: ['INVESTOR', 'SME', 'ADVISOR'],
            items: [
                { href: '/trading/launchpad', label: 'Token Launchpad', icon: Rocket, roles: ['INVESTOR', 'SME', 'ADVISOR'] },
                { href: '/secondary-trading', label: 'Secondary Market', icon: ArrowLeftRight, roles: ['INVESTOR', 'SME', 'ADVISOR'] },
            ]
        },
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
                { href: '/wallet', label: 'My Wallet', icon: Wallet, roles: ['ADVISOR', 'INVESTOR', 'SME'] },
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
            label: 'Platform Admin',
            roles: operatorRoles,
            items: [
                { href: '/admin/dashboard', label: 'Control Tower', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'AUDITOR'], permission: 'admin.read' },
                { href: '/trading/launchpad', label: 'Launchpad', icon: Rocket, roles: ['SUPER_ADMIN', 'ADMIN'] },
                { href: '/admin/users', label: 'User Management', icon: UserCog, roles: ['ADMIN', 'SUPER_ADMIN'] },
                { href: '/admin/role-lifecycle', label: 'Role Lifecycle', icon: Shield, roles: ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE'], permission: 'role_grant.list' },
                { href: '/admin/settings/branding', label: 'Platform Branding', icon: Palette, roles: ['ADMIN', 'SUPER_ADMIN'] },
                { href: '/admin/audit', label: 'System Audit', icon: History, roles: ['SUPER_ADMIN', 'ADMIN', 'AUDITOR', 'COMPLIANCE'] },
                { href: '/admin/bot', label: 'Telegram Management', icon: MessagesSquare, roles: ['SUPER_ADMIN', 'ADMIN'] },
            ]
        },
        {
            label: 'FinOps',
            roles: operatorRoles,
            items: [
                { href: '/admin/business-ops', label: 'Business Ops', icon: Briefcase, roles: ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'CX'], permission: 'admin.read' },
                { href: '/admin/billing', label: 'Billing Ops', icon: Wallet, roles: ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'AUDITOR'], permission: 'billing.read' },
                { href: '/admin/reconciliation', label: 'Reconciliation', icon: Wallet, roles: ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'AUDITOR'], permission: 'reconciliation.read' },
            ]
        },
        {
            label: 'CX Ops',
            roles: operatorRoles,
            items: [
                { href: '/admin/operations', label: 'Ops Readiness', icon: ShieldCheck, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX', 'COMPLIANCE'], permission: 'support_ticket.list' },
                { href: '/admin/cases', label: 'Case Management', icon: ClipboardList, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX', 'COMPLIANCE'], permission: 'case.list' },
                { href: '/admin/onboarding', label: 'Onboarding Ops', icon: ClipboardCheck, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX'], permission: 'onboarding_task.list' },
                { href: '/admin/advisor-ops', label: 'Advisor Ops', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN', 'CX'], permission: 'advisor_ops.read' },
            ]
        },
        {
            label: 'Compliance & Legal',
            roles: operatorRoles,
            items: [
                { href: '/admin/deal-ops', label: 'Deal Ops', icon: Briefcase, roles: ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE'], permission: 'admin.read' },
                { href: '/admin/investor-ops', label: 'Investor eKYC', icon: UsersRound, roles: ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE', 'CX'], permission: 'investor_ops.read' },
                { href: '/admin/data-governance', label: 'Data Governance', icon: ShieldCheck, roles: ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE', 'AUDITOR'], permission: 'data_governance.read' },
            ]
        },
        {
            label: 'Sales & Marketing',
            roles: operatorRoles,
            items: [
                { href: '/analytics', label: 'Demand Analytics', icon: TrendingUp, roles: ['SUPER_ADMIN', 'ADMIN', 'CX', 'ADVISOR'], permission: 'analytics.read' },
                { href: '/reports', label: 'Campaign & Sales Reports', icon: FileText, roles: ['SUPER_ADMIN', 'ADMIN', 'CX', 'ADVISOR'], permission: 'report.list' },
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
    const isTradingParticipantView = isTradingRuntime && (normalizedRole === 'INVESTOR' || normalizedRole === 'SME' || normalizedRole === 'ADVISOR') && !isTradingOperator
    const showTradingWidgets = true // Always show widgets for a rich application experience
    const tradingNavSections = isTradingParticipantView
        ? [
            {
                label: 'Navigation',
                roles: ['INVESTOR', 'SME', 'ADVISOR'],
                items: [
                    {
                        href: typeof window !== 'undefined' && isTradingHostname(window.location.hostname) ? CORE_FRONTEND_URL : '/dashboard',
                        label: 'Back to Main Portal',
                        icon: LayoutDashboard,
                        roles: ['INVESTOR', 'SME', 'ADVISOR']
                    }
                ]
            },
            {
                label: 'Trading',
                roles: ['INVESTOR', 'SME', 'ADVISOR'],
                items: [
                    { href: '/trading/launchpad', label: 'Token Launchpad', icon: Rocket, roles: ['INVESTOR', 'SME', 'ADVISOR'] },
                    { href: '/secondary-trading', label: 'Secondary Market', icon: ArrowLeftRight, roles: ['INVESTOR', 'SME', 'ADVISOR'] },
                    { href: '/trading/markets', label: 'Markets', icon: BarChart3, roles: ['INVESTOR', 'SME', 'ADVISOR'] },
                    { href: '/trading/wallet', label: 'My Wallet', icon: Wallet, roles: ['INVESTOR', 'SME', 'ADVISOR'] },
                    { href: '/trading/portfolio', label: 'My Portfolio', icon: Briefcase, roles: ['INVESTOR'] },
                    { href: '/trading/watchlist', label: 'Watchlist', icon: Sparkles, roles: ['INVESTOR'] },
                    { href: '/trading/profile', label: 'Investor Profile', icon: UserCog, roles: ['INVESTOR'] },
                    { href: '/trading/security', label: 'Investor Security', icon: ShieldCheck, roles: ['INVESTOR'] },
                ]
            },
            {
                label: 'Security',
                roles: ['INVESTOR'],
                items: [
                    { href: '/trading/sessions', label: 'Manage Sessions', icon: ShieldCheck, roles: ['INVESTOR'] },
                ]
            },
        ]
        : [
            {
                label: 'Navigation',
                roles: operatorRoles,
                items: [
                    {
                        href: typeof window !== 'undefined' && isTradingHostname(window.location.hostname) ? `${CORE_FRONTEND_URL}/admin/dashboard` : '/admin/dashboard',
                        label: 'Back to Main Portal',
                        icon: LayoutDashboard,
                        roles: operatorRoles
                    }
                ]
            },
            {
                label: 'Exchange Ops',
                roles: operatorRoles,
                items: [
                    { href: '/trading/operator/dashboard', label: 'Control Tower', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'AUDITOR'] },
                    { href: '/trading/launchpad', label: 'Token Launchpad', icon: Rocket, roles: ['SUPER_ADMIN', 'ADMIN', 'AUDITOR', 'COMPLIANCE'] },
                    { href: '/trading/operator/listing-control', label: 'Secondary Listing Governance', icon: ArrowLeftRight, roles: ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE', 'SUPPORT'] },
                    { href: '/trading/markets', label: 'Market Monitor', icon: BarChart3, roles: operatorRoles },
                ]
            },
            {
                label: 'Participant Ops',
                roles: operatorRoles,
                items: [
                    { href: '/trading/operator/investor-kyc', label: 'Investor eKYC', icon: UsersRound, roles: ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE', 'CX'] },
                    { href: '/trading/operator/onboarding', label: 'Participant Onboarding', icon: ClipboardCheck, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX'] },
                    { href: '/trading/operator/cases', label: 'Disputes & Support Cases', icon: ClipboardList, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX', 'COMPLIANCE'] },
                    { href: '/trading/operator/advisor-ops', label: 'Liquidity Partner Desk', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN', 'CX'] },
                ]
            },
            {
                label: 'Risk & Compliance',
                roles: operatorRoles,
                items: [
                    { href: '/trading/operator/operations', label: 'Market Surveillance', icon: ShieldCheck, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX', 'COMPLIANCE'] },
                    { href: '/trading/operator/deal-oversight', label: 'Issuer & Listing Compliance', icon: Briefcase, roles: ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE'] },
                    { href: '/trading/operator/data-governance', label: 'Data Retention & Legal Hold', icon: ShieldCheck, roles: ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE', 'AUDITOR'] },
                    { href: '/trading/operator/audit', label: 'Audit Trail', icon: History, roles: ['SUPER_ADMIN', 'ADMIN', 'AUDITOR', 'COMPLIANCE'] },
                ]
            },
            {
                label: 'Finance Ops',
                roles: operatorRoles,
                items: [
                    { href: '/trading/operator/reconciliation', label: 'Fee & Reconciliation', icon: Wallet, roles: ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'AUDITOR'] },
                    { href: '/trading/operator/billing', label: 'Billing & Payouts', icon: Wallet, roles: ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'AUDITOR'] },
                    { href: '/trading/operator/business-ops', label: 'Business Operations', icon: Briefcase, roles: ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'CX'] },
                ]
            },
            {
                label: 'Growth & Insights',
                roles: operatorRoles,
                items: [
                    { href: '/trading/operator/analytics', label: 'Exchange Analytics', icon: TrendingUp, roles: ['SUPER_ADMIN', 'ADMIN', 'CX'] },
                    { href: '/trading/operator/reports', label: 'Trading Reports Hub', icon: FileText, roles: ['SUPER_ADMIN', 'ADMIN', 'CX'] },
                ]
            },
            {
                label: 'Platform Security',
                roles: operatorRoles,
                items: [
                    { href: '/trading/operator/users', label: 'Operator Accounts', icon: UserCog, roles: ['SUPER_ADMIN', 'ADMIN'] },
                    { href: '/trading/operator/role-lifecycle', label: 'Access Lifecycle', icon: Shield, roles: ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE'] },
                    { href: '/trading/operator/security', label: 'Security Controls', icon: ShieldCheck, roles: operatorRoles },
                    { href: '/trading/sessions', label: 'Manage Sessions', icon: Shield, roles: operatorRoles },
                    { href: '/admin/bot', label: 'Telegram Management', icon: MessagesSquare, roles: ['SUPER_ADMIN', 'ADMIN'] },
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

    useEffect(() => {
        if (!isTradingRuntime || !user || !pathname) return

        const operatorAllowedPrefixes = [
            '/trading/operator',
            '/trading/markets',
            '/trading/sessions',
            '/trading/launchpad',
            '/admin/bot',
        ]
        const participantAllowedPrefixes = [
            '/trading/launchpad',
            '/secondary-trading',
            '/trading/markets',
            '/trading/terminal',
            '/trading/wallet',
            '/trading/watchlist',
            '/trading/profile',
            '/trading/portfolio',
            '/trading/security',
            '/trading/sessions',
            '/trading/notifications',
        ]

        if (isTradingOperator) {
            const isAllowedOperatorPath = operatorAllowedPrefixes.some((path) => pathname.startsWith(path))
            if (!isAllowedOperatorPath) {
                router.replace(TRADING_OPERATOR_HOME)
            }
            return
        }

        if (normalizedRole === 'INVESTOR' || normalizedRole === 'SME' || normalizedRole === 'ADVISOR') {
            const isAllowedParticipantPath = participantAllowedPrefixes.some((path) => pathname.startsWith(path))
            if (!isAllowedParticipantPath) {
                router.replace('/secondary-trading')
            }
        }
    }, [isTradingRuntime, isTradingOperator, normalizedRole, pathname, router, user])

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
                    {!isTradingRuntime && <LanguageSwitcher />}
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
                {/* Desktop Header for Trading Runtime - Institutional Navigation Structure */}
                {isTradingRuntime && (
                    <header className="hidden md:flex items-center justify-between h-20 px-8 bg-gray-900/50 backdrop-blur-xl border-b border-gray-800 sticky top-0 z-30">
                        <div className="flex items-center space-x-2">
                            <span className="text-sm font-black text-gray-500 uppercase tracking-widest px-3 py-1 bg-gray-800 rounded-lg">CamboBia</span>
                            <ChevronRight className="w-4 h-4 text-gray-700" />
                            <span className="text-sm font-bold text-blue-400 capitalize">{pathname?.split('/').pop()?.replace('-', ' ')}</span>
                        </div>
                        <div className="flex items-center space-x-6">
                            <LanguageSwitcher />
                            <div className="h-8 w-[1px] bg-gray-800 mx-2" />
                            <NotificationCenter />
                            {user && (
                                <div className="flex items-center space-x-3 pl-4 border-l border-gray-800">
                                    <div className="flex flex-col items-end mr-3">
                                        <p className="text-sm font-black text-white leading-none">{user.firstName} {user.lastName}</p>
                                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">{normalizedRole}</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-black shadow-lg">
                                        {user.firstName?.[0]}{user.lastName?.[1] || user.lastName?.[0]}
                                    </div>
                                </div>
                            )}
                        </div>
                    </header>
                )}

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    {children}
                </div>
            </main>

            {/* AI Chatbot Widget */}
            {showTradingWidgets && <Chatbot />}
        </div>
    )
}
