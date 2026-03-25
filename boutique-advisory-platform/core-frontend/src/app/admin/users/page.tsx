'use client'

import { useState, useEffect } from 'react'
import {
    Users,
    Search,
    Shield,
    UserPlus,
    UserCheck,
    UserX,
    MoreHorizontal,
    Trash2
} from 'lucide-react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authorizedRequest } from '../../../lib/api'
import { useToast } from '../../../contexts/ToastContext'

interface UserRecord {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    status: string;
    createdAt: string;
}

interface RbacOverview {
    roles: string[];
    permissionKeys: string[];
    matrix: Array<{ role: string; permissions: string[] }>;
}

interface RoleFeatureConfig {
    role: string;
    config: {
        walletEnabled: boolean;
        paymentEnabled: boolean;
    };
}

interface RolePermissionConfig {
    role: string;
    config: {
        mode: 'extend' | 'replace';
        permissions: string[];
    };
}

interface CustomRoleConfig {
    code: string;
    name: string;
    baseRole: string;
    description?: string;
    permissions: string[];
    enabled: boolean;
}

interface AbacPolicy {
    id?: string;
    name: string;
    resource: string;
    action: string;
    effect: 'ALLOW' | 'DENY';
    priority: number;
    enabled: boolean;
    config: {
        conditions: Array<{ field: string; op: string; value?: any }>;
        description?: string;
    };
}

export default function UserManagementPage() {
    const { addToast } = useToast()
    const [users, setUsers] = useState<UserRecord[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [roleFilter, setRoleFilter] = useState('ALL')
    const [statusFilter, setStatusFilter] = useState('')
    const [showAddUserModal, setShowAddUserModal] = useState(false)
    const [newUser, setNewUser] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'SME'
    })
    const [rbacOverview, setRbacOverview] = useState<RbacOverview | null>(null)
    const [rbacRole, setRbacRole] = useState('SME')
    const [rbacPermission, setRbacPermission] = useState('deal.read')
    const [rbacIsOwner, setRbacIsOwner] = useState(false)
    const [rbacResult, setRbacResult] = useState<{ allowed: boolean; reason: string } | null>(null)
    const [isRbacChecking, setIsRbacChecking] = useState(false)
    const [recentDenials, setRecentDenials] = useState<Array<{ userRole: string; permission: string; reason: string; timestamp: string }>>([])
    const [roleFeatureConfigs, setRoleFeatureConfigs] = useState<RoleFeatureConfig[]>([])
    const [isSavingRoleFeatures, setIsSavingRoleFeatures] = useState(false)
    const [permissionCatalog, setPermissionCatalog] = useState<string[]>([])
    const [rolePermissionConfigs, setRolePermissionConfigs] = useState<RolePermissionConfig[]>([])
    const [rolePermissionRole, setRolePermissionRole] = useState('SME')
    const [rolePermissionMode, setRolePermissionMode] = useState<'extend' | 'replace'>('replace')
    const [rolePermissionSelection, setRolePermissionSelection] = useState<string[]>([])
    const [rolePermissionSearch, setRolePermissionSearch] = useState('')
    const [isSavingRolePermissions, setIsSavingRolePermissions] = useState(false)
    const [customRoles, setCustomRoles] = useState<CustomRoleConfig[]>([])
    const [selectedCustomRoleCode, setSelectedCustomRoleCode] = useState('')
    const [customRoleDraft, setCustomRoleDraft] = useState<CustomRoleConfig>({
        code: '',
        name: '',
        baseRole: 'INVESTOR',
        description: '',
        permissions: [],
        enabled: true
    })
    const [customRoleSearch, setCustomRoleSearch] = useState('')
    const [isSavingCustomRole, setIsSavingCustomRole] = useState(false)
    const [selectedUserForCustomRoles, setSelectedUserForCustomRoles] = useState('')
    const [selectedUserCustomRoles, setSelectedUserCustomRoles] = useState<string[]>([])
    const [isSavingUserCustomRoles, setIsSavingUserCustomRoles] = useState(false)
    const [abacPolicies, setAbacPolicies] = useState<AbacPolicy[]>([])
    const [selectedAbacPolicyId, setSelectedAbacPolicyId] = useState('')
    const [abacDraft, setAbacDraft] = useState<AbacPolicy>({
        name: '',
        resource: '',
        action: '',
        effect: 'ALLOW',
        priority: 0,
        enabled: true,
        config: { conditions: [] }
    })
    const [abacConditionsJson, setAbacConditionsJson] = useState('[]')
    const [isSavingAbac, setIsSavingAbac] = useState(false)

    useEffect(() => {
        fetchUsers()
        fetchRbacOverview()
        fetchRecentDenials()
        fetchRoleFeatures()
        fetchRolePermissions()
        fetchCustomRoles()
        fetchAbacPolicies()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter])

    useEffect(() => {
        const config = rolePermissionConfigs.find((item) => item.role === rolePermissionRole)
        if (config) {
            setRolePermissionMode(config.config.mode)
            setRolePermissionSelection(config.config.permissions || [])
        } else {
            setRolePermissionMode('replace')
            setRolePermissionSelection([])
        }
    }, [rolePermissionConfigs, rolePermissionRole])

    useEffect(() => {
        if (!selectedCustomRoleCode) return
        const role = customRoles.find((item) => item.code === selectedCustomRoleCode)
        if (role) {
            setCustomRoleDraft(role)
        }
    }, [customRoles, selectedCustomRoleCode])

    useEffect(() => {
        if (selectedCustomRoleCode) return
        setCustomRoleDraft({
            code: '',
            name: '',
            baseRole: 'INVESTOR',
            description: '',
            permissions: [],
            enabled: true
        })
    }, [selectedCustomRoleCode])

    useEffect(() => {
        if (!selectedAbacPolicyId) return
        const policy = abacPolicies.find((item) => item.id === selectedAbacPolicyId)
        if (policy) {
            setAbacDraft(policy)
            setAbacConditionsJson(JSON.stringify(policy.config?.conditions || [], null, 2))
        }
    }, [abacPolicies, selectedAbacPolicyId])

    useEffect(() => {
        if (selectedAbacPolicyId) return
        setAbacDraft({
            name: '',
            resource: '',
            action: '',
            effect: 'ALLOW',
            priority: 0,
            enabled: true,
            config: { conditions: [] }
        })
        setAbacConditionsJson('[]')
    }, [selectedAbacPolicyId])

    useEffect(() => {
        if (!selectedUserForCustomRoles) return
        loadUserCustomRoles(selectedUserForCustomRoles)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedUserForCustomRoles])

    const fetchUsers = async () => {
        setIsLoading(true)
        try {
            const queryParams = new URLSearchParams()
            if (statusFilter) queryParams.append('status', statusFilter)

            const response = await authorizedRequest(`/api/admin/users?${queryParams.toString()}`)
            if (response.ok) {
                const data = await response.json()
                setUsers(data.users || [])
            }
        } catch (error) {
            console.error('Error fetching users:', error)
            addToast('error', 'Failed to load users')
        } finally {
            setIsLoading(false)
        }
    }

    const fetchRbacOverview = async () => {
        try {
            const response = await authorizedRequest('/api/admin/rbac/overview')
            if (!response.ok) return
            const data = await response.json()
            setRbacOverview(data)
            if (Array.isArray(data.permissionKeys)) {
                const baseKeys = data.permissionKeys as string[]
                const ownerKeys = baseKeys.map((key) => `${key}:owner`)
                setPermissionCatalog([...baseKeys, ...ownerKeys])
            }
            if (Array.isArray(data.roles) && data.roles.length > 0) {
                setRbacRole(data.roles.includes(rbacRole) ? rbacRole : data.roles[0])
            }
            if (Array.isArray(data.permissionKeys) && data.permissionKeys.length > 0) {
                setRbacPermission(data.permissionKeys.includes(rbacPermission) ? rbacPermission : data.permissionKeys[0])
            }
        } catch (error) {
            console.error('Error loading RBAC overview:', error)
        }
    }

    const fetchRecentDenials = async () => {
        try {
            const response = await authorizedRequest('/api/admin/rbac/denials?limit=10')
            if (!response.ok) return
            const data = await response.json()
            setRecentDenials(data.denials || [])
        } catch (error) {
            console.error('Error loading RBAC denials:', error)
        }
    }

    const fetchRoleFeatures = async () => {
        try {
            const response = await authorizedRequest('/api/admin/role-features')
            if (!response.ok) return
            const data = await response.json()
            if (Array.isArray(data.configs)) {
                setRoleFeatureConfigs(data.configs)
            }
        } catch (error) {
            console.error('Error loading role features:', error)
        }
    }

    const fetchRolePermissions = async () => {
        try {
            const response = await authorizedRequest('/api/admin/role-permissions')
            if (!response.ok) return
            const data = await response.json()
            if (Array.isArray(data.configs)) {
                setRolePermissionConfigs(data.configs)
            }
            if (Array.isArray(data.roles) && data.roles.length > 0) {
                setRolePermissionRole(data.roles.includes(rolePermissionRole) ? rolePermissionRole : data.roles[0])
            }
        } catch (error) {
            console.error('Error loading role permissions:', error)
        }
    }

    const fetchCustomRoles = async () => {
        try {
            const response = await authorizedRequest('/api/admin/custom-roles')
            if (!response.ok) return
            const data = await response.json()
            if (Array.isArray(data.roles)) {
                setCustomRoles(data.roles)
                if (data.roles.length > 0 && !selectedCustomRoleCode) {
                    setSelectedCustomRoleCode(data.roles[0].code)
                    setCustomRoleDraft(data.roles[0])
                }
            }
        } catch (error) {
            console.error('Error loading custom roles:', error)
        }
    }

    const fetchAbacPolicies = async () => {
        try {
            const response = await authorizedRequest('/api/admin/abac-policies')
            if (!response.ok) return
            const data = await response.json()
            if (Array.isArray(data.policies)) {
                setAbacPolicies(data.policies)
                if (data.policies.length > 0 && !selectedAbacPolicyId) {
                    setSelectedAbacPolicyId(data.policies[0].id)
                    setAbacDraft(data.policies[0])
                    setAbacConditionsJson(JSON.stringify(data.policies[0].config?.conditions || [], null, 2))
                }
            }
        } catch (error) {
            console.error('Error loading ABAC policies:', error)
        }
    }

    const updateRoleFeature = async (role: string, patch: Partial<RoleFeatureConfig['config']>) => {
        setIsSavingRoleFeatures(true)
        try {
            const current = roleFeatureConfigs.find((cfg) => cfg.role === role)
            const nextConfig = {
                walletEnabled: Boolean(patch.walletEnabled ?? current?.config.walletEnabled),
                paymentEnabled: Boolean(patch.paymentEnabled ?? current?.config.paymentEnabled)
            }
            const response = await authorizedRequest(`/api/admin/role-features/${role}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nextConfig)
            })
            if (response.ok) {
                const data = await response.json()
                setRoleFeatureConfigs((prev) =>
                    prev.map((item) => (item.role === role ? { role, config: data.config } : item))
                )
                addToast('success', 'Role feature settings updated')
            } else {
                const payload = await response.json().catch(() => ({}))
                addToast('error', payload?.error || 'Failed to update role features')
            }
        } catch (error) {
            console.error('Error updating role features:', error)
            addToast('error', 'Failed to update role features')
        } finally {
            setIsSavingRoleFeatures(false)
        }
    }

    const saveRolePermissions = async () => {
        setIsSavingRolePermissions(true)
        try {
            const response = await authorizedRequest(`/api/admin/role-permissions/${rolePermissionRole}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: rolePermissionMode,
                    permissions: rolePermissionSelection
                })
            })
            if (response.ok) {
                const data = await response.json()
                setRolePermissionConfigs((prev) =>
                    prev.map((item) => (item.role === rolePermissionRole ? { role: rolePermissionRole, config: data.config } : item))
                )
                addToast('success', 'Role permissions updated')
            } else {
                const payload = await response.json().catch(() => ({}))
                addToast('error', payload?.error || 'Failed to update role permissions')
            }
        } catch (error) {
            console.error('Error updating role permissions:', error)
            addToast('error', 'Failed to update role permissions')
        } finally {
            setIsSavingRolePermissions(false)
        }
    }

    const handleCustomRoleSave = async () => {
        setIsSavingCustomRole(true)
        try {
            const method = selectedCustomRoleCode ? 'PUT' : 'POST'
            const endpoint = selectedCustomRoleCode
                ? `/api/admin/custom-roles/${selectedCustomRoleCode}`
                : '/api/admin/custom-roles'
            const response = await authorizedRequest(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customRoleDraft)
            })
            if (response.ok) {
                const data = await response.json()
                const role = data.role || customRoleDraft
                setCustomRoles((prev) => {
                    const existing = prev.find((item) => item.code === role.code)
                    if (existing) {
                        return prev.map((item) => (item.code === role.code ? role : item))
                    }
                    return [...prev, role]
                })
                setSelectedCustomRoleCode(role.code)
                setCustomRoleDraft(role)
                addToast('success', 'Custom role saved')
            } else {
                const payload = await response.json().catch(() => ({}))
                addToast('error', payload?.error || 'Failed to save custom role')
            }
        } catch (error) {
            console.error('Error saving custom role:', error)
            addToast('error', 'Failed to save custom role')
        } finally {
            setIsSavingCustomRole(false)
        }
    }

    const loadUserCustomRoles = async (userId: string) => {
        if (!userId) return
        try {
            const response = await authorizedRequest(`/api/admin/users/${userId}/custom-roles`)
            if (!response.ok) return
            const data = await response.json()
            setSelectedUserCustomRoles(Array.isArray(data.roleCodes) ? data.roleCodes : [])
        } catch (error) {
            console.error('Error loading user custom roles:', error)
        }
    }

    const saveUserCustomRoles = async () => {
        if (!selectedUserForCustomRoles) return
        setIsSavingUserCustomRoles(true)
        try {
            const response = await authorizedRequest(`/api/admin/users/${selectedUserForCustomRoles}/custom-roles`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roleCodes: selectedUserCustomRoles })
            })
            if (response.ok) {
                addToast('success', 'User custom roles updated')
            } else {
                const payload = await response.json().catch(() => ({}))
                addToast('error', payload?.error || 'Failed to update user custom roles')
            }
        } catch (error) {
            console.error('Error updating user custom roles:', error)
            addToast('error', 'Failed to update user custom roles')
        } finally {
            setIsSavingUserCustomRoles(false)
        }
    }

    const saveAbacPolicy = async () => {
        setIsSavingAbac(true)
        try {
            let conditions: Array<{ field: string; op: string; value?: any }> = []
            try {
                const parsed = JSON.parse(abacConditionsJson || '[]')
                if (Array.isArray(parsed)) {
                    conditions = parsed
                }
            } catch (error) {
                addToast('error', 'Conditions must be valid JSON array')
                setIsSavingAbac(false)
                return
            }

            const payload = {
                ...abacDraft,
                config: {
                    conditions,
                    description: abacDraft.config?.description
                }
            }

            const endpoint = selectedAbacPolicyId
                ? `/api/admin/abac-policies/${selectedAbacPolicyId}`
                : '/api/admin/abac-policies'
            const method = selectedAbacPolicyId ? 'PUT' : 'POST'
            const response = await authorizedRequest(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            if (response.ok) {
                const data = await response.json()
                const policy = data.policy || payload
                setAbacPolicies((prev) => {
                    const existing = prev.find((item) => item.id === policy.id)
                    if (existing) {
                        return prev.map((item) => (item.id === policy.id ? policy : item))
                    }
                    return [...prev, policy]
                })
                setSelectedAbacPolicyId(policy.id || '')
                setAbacDraft(policy)
                setAbacConditionsJson(JSON.stringify(policy.config?.conditions || [], null, 2))
                addToast('success', 'ABAC policy saved')
            } else {
                const data = await response.json().catch(() => ({}))
                addToast('error', data.error || 'Failed to save ABAC policy')
            }
        } catch (error) {
            console.error('Error saving ABAC policy:', error)
            addToast('error', 'Failed to save ABAC policy')
        } finally {
            setIsSavingAbac(false)
        }
    }

    const runRbacCheck = async () => {
        setIsRbacChecking(true)
        setRbacResult(null)
        try {
            const response = await authorizedRequest('/api/admin/rbac/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: rbacRole,
                    permission: rbacPermission,
                    isOwner: rbacIsOwner
                })
            })
            const data = await response.json()
            if (!response.ok) {
                addToast('error', data.error || 'RBAC check failed')
                return
            }
            setRbacResult({ allowed: Boolean(data.allowed), reason: String(data.reason || 'denied') })
        } catch (error) {
            console.error('Error running RBAC check:', error)
            addToast('error', 'Failed to run RBAC diagnostic')
        } finally {
            setIsRbacChecking(false)
        }
    }

    const updateStatus = async (userId: string, status: string) => {
        if (status === 'DELETED') {
            const confirmed = window.confirm('Delete this user account? This is a soft delete and can affect linked profiles.')
            if (!confirmed) return
        }

        try {
            const response = await authorizedRequest(`/api/admin/users/${userId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            })
            if (response.ok) {
                addToast('success', `User status updated to ${status}`)
                fetchUsers()
            }
        } catch (error) {
            addToast('error', 'Failed to update status')
        }
    }

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const response = await authorizedRequest('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            })

            if (response.ok) {
                addToast('success', 'User created successfully')
                setShowAddUserModal(false)
                setNewUser({ firstName: '', lastName: '', email: '', password: '', role: 'SME' })
                fetchUsers()
            } else {
                const data = await response.json()
                addToast('error', data.error || 'Failed to create user')
            }
        } catch (error) {
            addToast('error', 'Failed to create user')
        }
    }

    const filteredUsers = users.filter(u => {
        const matchesSearch = (u.firstName + ' ' + u.lastName + ' ' + u.email).toLowerCase().includes(searchQuery.toLowerCase())
        const matchesRole = roleFilter === 'ALL' || u.role === roleFilter
        return matchesSearch && matchesRole
    })

    const getRoleBadge = (role: string) => {
        const styles: Record<string, string> = {
            SUPER_ADMIN: 'bg-red-500/10 text-red-400 border-red-500/20',
            ADMIN: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
            ADVISOR: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
            INVESTOR: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            SME: 'bg-green-500/10 text-green-400 border-green-500/20',
        }
        return (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${styles[role] || 'bg-gray-500/10 text-gray-400'}`}>
                {role}
            </span>
        )
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <Users className="w-8 h-8 text-blue-400" />
                            User Management
                        </h1>
                        <p className="text-gray-400 mt-1">Manage global user accounts, roles, and access status.</p>
                    </div>
                    <button
                        onClick={() => setShowAddUserModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-blue-900/40"
                    >
                        <UserPlus className="w-5 h-5" />
                        Add New User
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            className="w-full bg-gray-900 border-gray-700 rounded-xl pl-10 text-white focus:ring-blue-500"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-4">
                        <div className="flex bg-gray-900 p-1 rounded-xl">
                            {['ALL', 'ACTIVE', 'SUSPENDED', 'DELETED'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status === 'ALL' ? '' : status)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${(statusFilter === status || (status === 'ALL' && statusFilter === ''))
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                                </button>
                            ))}
                        </div>

                        <select
                            className="bg-gray-900 border-gray-700 rounded-xl text-white px-4 py-2 focus:ring-blue-500"
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            <option value="ALL">All Roles</option>
                            <option value="SUPER_ADMIN">Super Admin</option>
                            <option value="ADMIN">Admin</option>
                            <option value="ADVISOR">Advisor</option>
                            <option value="INVESTOR">Investor</option>
                            <option value="SME">SME</option>
                        </select>
                    </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-emerald-400" />
                            <h2 className="text-white font-semibold">Role Feature Configuration</h2>
                        </div>
                        <span className="text-xs text-gray-400">Changes are encrypted and audited</span>
                    </div>
                    <p className="text-xs text-gray-400">
                        Configure which roles can access Wallet and Payments. These settings are stored in the database and enforced in the UI and API.
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="text-xs uppercase text-gray-400">
                                    <th className="py-2">Role</th>
                                    <th className="py-2">Wallet</th>
                                    <th className="py-2">Payments</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {roleFeatureConfigs.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="py-4 text-gray-500">No role feature configs found.</td>
                                    </tr>
                                ) : roleFeatureConfigs.map((row) => (
                                    <tr key={row.role}>
                                        <td className="py-3 text-gray-200 font-medium">{row.role}</td>
                                        <td className="py-3">
                                            <label className="inline-flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={row.config.walletEnabled}
                                                    disabled={isSavingRoleFeatures}
                                                    onChange={(e) => updateRoleFeature(row.role, { walletEnabled: e.target.checked })}
                                                />
                                                <span className="text-gray-300">Enabled</span>
                                            </label>
                                        </td>
                                        <td className="py-3">
                                            <label className="inline-flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={row.config.paymentEnabled}
                                                    disabled={isSavingRoleFeatures}
                                                    onChange={(e) => updateRoleFeature(row.role, { paymentEnabled: e.target.checked })}
                                                />
                                                <span className="text-gray-300">Enabled</span>
                                            </label>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-cyan-400" />
                            <h2 className="text-white font-semibold">Role Permission Overrides</h2>
                        </div>
                        <span className="text-xs text-gray-400">Encrypted config + audit trail</span>
                    </div>
                    <p className="text-xs text-gray-400">
                        Override or extend base role permissions. Use replace to fully control access or extend to add new permissions on top of defaults.
                    </p>
                    <div className="grid md:grid-cols-4 gap-3">
                        <select
                            className="bg-gray-900 border-gray-700 rounded-xl text-white px-3 py-2"
                            value={rolePermissionRole}
                            onChange={(e) => setRolePermissionRole(e.target.value)}
                        >
                            {(rbacOverview?.roles || []).map((role) => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                        <select
                            className="bg-gray-900 border-gray-700 rounded-xl text-white px-3 py-2"
                            value={rolePermissionMode}
                            onChange={(e) => setRolePermissionMode(e.target.value as 'extend' | 'replace')}
                        >
                            <option value="replace">Replace</option>
                            <option value="extend">Extend</option>
                        </select>
                        <input
                            className="bg-gray-900 border border-gray-700 rounded-xl text-white px-3 py-2 md:col-span-2"
                            placeholder="Filter permissions"
                            value={rolePermissionSearch}
                            onChange={(e) => setRolePermissionSearch(e.target.value)}
                        />
                    </div>
                    <div className="grid md:grid-cols-2 gap-2 max-h-64 overflow-y-auto border border-gray-700 rounded-xl p-3 bg-gray-900/60">
                        {(permissionCatalog.filter((permission) =>
                            permission.toLowerCase().includes(rolePermissionSearch.toLowerCase())
                        )).map((permission) => (
                            <label key={permission} className="flex items-center gap-2 text-sm text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={rolePermissionSelection.includes(permission)}
                                    onChange={(e) => {
                                        setRolePermissionSelection((prev) => {
                                            if (e.target.checked) return [...prev, permission]
                                            return prev.filter((item) => item !== permission)
                                        })
                                    }}
                                />
                                <span>{permission}</span>
                            </label>
                        ))}
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-400">Selected: {rolePermissionSelection.length}</div>
                        <button
                            onClick={saveRolePermissions}
                            disabled={isSavingRolePermissions}
                            className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                        >
                            {isSavingRolePermissions ? 'Saving...' : 'Save Role Permissions'}
                        </button>
                    </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-purple-400" />
                            <h2 className="text-white font-semibold">Custom Roles (Sub-Roles)</h2>
                        </div>
                        <span className="text-xs text-gray-400">Extend base roles without code changes</span>
                    </div>
                    <div className="grid md:grid-cols-3 gap-3">
                        <select
                            className="bg-gray-900 border-gray-700 rounded-xl text-white px-3 py-2"
                            value={selectedCustomRoleCode}
                            onChange={(e) => setSelectedCustomRoleCode(e.target.value)}
                        >
                            <option value="">New Custom Role</option>
                            {customRoles.map((role) => (
                                <option key={role.code} value={role.code}>{role.code}</option>
                            ))}
                        </select>
                        <input
                            className="bg-gray-900 border border-gray-700 rounded-xl text-white px-3 py-2"
                            placeholder="Role code"
                            value={customRoleDraft.code}
                            disabled={Boolean(selectedCustomRoleCode)}
                            onChange={(e) => setCustomRoleDraft({ ...customRoleDraft, code: e.target.value })}
                        />
                        <input
                            className="bg-gray-900 border border-gray-700 rounded-xl text-white px-3 py-2"
                            placeholder="Role name"
                            value={customRoleDraft.name}
                            onChange={(e) => setCustomRoleDraft({ ...customRoleDraft, name: e.target.value })}
                        />
                        <select
                            className="bg-gray-900 border-gray-700 rounded-xl text-white px-3 py-2"
                            value={customRoleDraft.baseRole}
                            onChange={(e) => setCustomRoleDraft({ ...customRoleDraft, baseRole: e.target.value })}
                        >
                            {(rbacOverview?.roles || []).map((role) => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                            <option value="ANY">ANY</option>
                        </select>
                        <input
                            className="bg-gray-900 border border-gray-700 rounded-xl text-white px-3 py-2 md:col-span-2"
                            placeholder="Description"
                            value={customRoleDraft.description || ''}
                            onChange={(e) => setCustomRoleDraft({ ...customRoleDraft, description: e.target.value })}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                            <input
                                type="checkbox"
                                checked={customRoleDraft.enabled}
                                onChange={(e) => setCustomRoleDraft({ ...customRoleDraft, enabled: e.target.checked })}
                            />
                            Enabled
                        </label>
                        <input
                            className="bg-gray-900 border border-gray-700 rounded-xl text-white px-3 py-2 flex-1"
                            placeholder="Filter permissions"
                            value={customRoleSearch}
                            onChange={(e) => setCustomRoleSearch(e.target.value)}
                        />
                    </div>
                    <div className="grid md:grid-cols-2 gap-2 max-h-64 overflow-y-auto border border-gray-700 rounded-xl p-3 bg-gray-900/60">
                        {(permissionCatalog.filter((permission) =>
                            permission.toLowerCase().includes(customRoleSearch.toLowerCase())
                        )).map((permission) => (
                            <label key={permission} className="flex items-center gap-2 text-sm text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={customRoleDraft.permissions.includes(permission)}
                                    onChange={(e) => {
                                        setCustomRoleDraft((prev) => {
                                            if (e.target.checked) {
                                                return { ...prev, permissions: [...prev.permissions, permission] }
                                            }
                                            return { ...prev, permissions: prev.permissions.filter((item) => item !== permission) }
                                        })
                                    }}
                                />
                                <span>{permission}</span>
                            </label>
                        ))}
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-400">Selected: {customRoleDraft.permissions.length}</div>
                        <button
                            onClick={handleCustomRoleSave}
                            disabled={isSavingCustomRole}
                            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                        >
                            {isSavingCustomRole ? 'Saving...' : 'Save Custom Role'}
                        </button>
                    </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-orange-400" />
                        <h2 className="text-white font-semibold">Assign Custom Roles to Users</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-3">
                        <select
                            className="bg-gray-900 border-gray-700 rounded-xl text-white px-3 py-2 md:col-span-2"
                            value={selectedUserForCustomRoles}
                            onChange={(e) => setSelectedUserForCustomRoles(e.target.value)}
                        >
                            <option value="">Select a user</option>
                            {users.map((user) => (
                                <option key={user.id} value={user.id}>
                                    {user.firstName} {user.lastName} ({user.email})
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={saveUserCustomRoles}
                            disabled={isSavingUserCustomRoles || !selectedUserForCustomRoles}
                            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                        >
                            {isSavingUserCustomRoles ? 'Saving...' : 'Save Assignments'}
                        </button>
                    </div>
                    <div className="grid md:grid-cols-2 gap-2 max-h-64 overflow-y-auto border border-gray-700 rounded-xl p-3 bg-gray-900/60">
                        {customRoles.length === 0 ? (
                            <div className="text-sm text-gray-500">No custom roles configured yet.</div>
                        ) : customRoles.map((role) => (
                            <label key={role.code} className="flex items-center gap-2 text-sm text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={selectedUserCustomRoles.includes(role.code)}
                                    onChange={(e) => {
                                        setSelectedUserCustomRoles((prev) => {
                                            if (e.target.checked) return [...prev, role.code]
                                            return prev.filter((item) => item !== role.code)
                                        })
                                    }}
                                />
                                <span>{role.code}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-rose-400" />
                            <h2 className="text-white font-semibold">ABAC Policy Editor</h2>
                        </div>
                        <span className="text-xs text-gray-400">Policy evaluation: RBAC AND ABAC</span>
                    </div>
                    <p className="text-xs text-gray-400">
                        Policies apply only when RBAC allows. Use conditions to restrict access by attributes like user role, tenant, and ownership.
                    </p>
                    <div className="grid md:grid-cols-3 gap-3">
                        <select
                            className="bg-gray-900 border-gray-700 rounded-xl text-white px-3 py-2"
                            value={selectedAbacPolicyId}
                            onChange={(e) => setSelectedAbacPolicyId(e.target.value)}
                        >
                            <option value="">New Policy</option>
                            {abacPolicies.map((policy) => (
                                <option key={policy.id} value={policy.id}>{policy.name}</option>
                            ))}
                        </select>
                        <input
                            className="bg-gray-900 border border-gray-700 rounded-xl text-white px-3 py-2"
                            placeholder="Policy name"
                            value={abacDraft.name}
                            onChange={(e) => setAbacDraft({ ...abacDraft, name: e.target.value })}
                        />
                        <select
                            className="bg-gray-900 border-gray-700 rounded-xl text-white px-3 py-2"
                            value={abacDraft.effect}
                            onChange={(e) => setAbacDraft({ ...abacDraft, effect: e.target.value as 'ALLOW' | 'DENY' })}
                        >
                            <option value="ALLOW">ALLOW</option>
                            <option value="DENY">DENY</option>
                        </select>
                        <input
                            className="bg-gray-900 border border-gray-700 rounded-xl text-white px-3 py-2"
                            placeholder="Resource (e.g., deal)"
                            value={abacDraft.resource}
                            onChange={(e) => setAbacDraft({ ...abacDraft, resource: e.target.value })}
                        />
                        <input
                            className="bg-gray-900 border border-gray-700 rounded-xl text-white px-3 py-2"
                            placeholder="Action (e.g., read)"
                            value={abacDraft.action}
                            onChange={(e) => setAbacDraft({ ...abacDraft, action: e.target.value })}
                        />
                        <input
                            className="bg-gray-900 border border-gray-700 rounded-xl text-white px-3 py-2"
                            placeholder="Priority (higher wins)"
                            type="number"
                            value={abacDraft.priority}
                            onChange={(e) => setAbacDraft({ ...abacDraft, priority: Number(e.target.value || 0) })}
                        />
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                        <input
                            type="checkbox"
                            checked={abacDraft.enabled}
                            onChange={(e) => setAbacDraft({ ...abacDraft, enabled: e.target.checked })}
                        />
                        Enabled
                    </label>
                    <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-3 space-y-2">
                        <div className="text-xs text-gray-400">Conditions JSON (array)</div>
                        <textarea
                            className="w-full min-h-[140px] bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-200 p-2"
                            value={abacConditionsJson}
                            onChange={(e) => setAbacConditionsJson(e.target.value)}
                        />
                        <div className="text-xs text-gray-500">
                            Available attributes: `user.id`, `user.role`, `user.tenantId`, `tenantId`, `resource.id`, `resource.ownerId`, `resource.isOwner`.
                        </div>
                        <div className="text-xs text-gray-500">
                            Example: `[{{\"field\":\"user.role\",\"op\":\"equals\",\"value\":\"INVESTOR\"}},{{\"field\":\"resource.isOwner\",\"op\":\"equals\",\"value\":true}}]`
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={saveAbacPolicy}
                            disabled={isSavingAbac}
                            className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                        >
                            {isSavingAbac ? 'Saving...' : 'Save ABAC Policy'}
                        </button>
                    </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-400" />
                        <h2 className="text-white font-semibold">RBAC Diagnostics</h2>
                    </div>
                    <p className="text-xs text-gray-400">
                        Check exact permission outcomes and inspect recent denied authorization attempts.
                    </p>
                    <div className="grid md:grid-cols-4 gap-3">
                        <select
                            className="bg-gray-900 border-gray-700 rounded-xl text-white px-3 py-2"
                            value={rbacRole}
                            onChange={(e) => setRbacRole(e.target.value)}
                        >
                            {(rbacOverview?.roles || []).map((role) => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                        <select
                            className="bg-gray-900 border-gray-700 rounded-xl text-white px-3 py-2 md:col-span-2"
                            value={rbacPermission}
                            onChange={(e) => setRbacPermission(e.target.value)}
                        >
                            {(rbacOverview?.permissionKeys || []).map((permission) => (
                                <option key={permission} value={permission}>{permission}</option>
                            ))}
                        </select>
                        <label className="flex items-center gap-2 text-sm text-gray-300 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2">
                            <input
                                type="checkbox"
                                checked={rbacIsOwner}
                                onChange={(e) => setRbacIsOwner(e.target.checked)}
                            />
                            Owner context
                        </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={runRbacCheck}
                            disabled={isRbacChecking}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                        >
                            {isRbacChecking ? 'Checking...' : 'Run Check'}
                        </button>
                        {rbacResult && (
                            <div className={`text-sm px-3 py-2 rounded-lg border ${rbacResult.allowed ? 'bg-green-500/10 text-green-300 border-green-600/30' : 'bg-red-500/10 text-red-300 border-red-600/30'}`}>
                                {rbacResult.allowed ? 'Allowed' : 'Denied'} via `{rbacResult.reason}`
                            </div>
                        )}
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-3">
                            <h3 className="text-xs text-gray-400 uppercase mb-2">Role Permission Count</h3>
                            <div className="space-y-1 text-sm">
                                {(rbacOverview?.matrix || []).map((row) => (
                                    <div key={row.role} className="flex justify-between text-gray-300">
                                        <span>{row.role}</span>
                                        <span>{row.permissions.length}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-3">
                            <h3 className="text-xs text-gray-400 uppercase mb-2">Recent Denied Checks</h3>
                            <div className="space-y-1 text-xs text-gray-300 max-h-32 overflow-auto">
                                {recentDenials.length === 0 ? (
                                    <p className="text-gray-500">No denied checks captured yet.</p>
                                ) : recentDenials.map((denial, idx) => (
                                    <p key={idx}>
                                        {denial.userRole} denied `{denial.permission}` ({denial.reason})
                                    </p>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* User Table */}
                <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-900/50 border-b border-gray-700">
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Joined</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider flex justify-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                                            Loading users...
                                        </td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            No users found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-700/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold">
                                                        {user.firstName[0]}{user.lastName[0]}
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-medium">{user.firstName} {user.lastName}</p>
                                                        <p className="text-gray-500 text-xs">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {getRoleBadge(user.role)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`flex items-center gap-1.5 text-xs font-medium ${user.status === 'ACTIVE' ? 'text-green-400' :
                                                    user.status === 'SUSPENDED' ? 'text-red-400' : 'text-gray-400'
                                                    }`}>
                                                    <span className={`w-2 h-2 rounded-full ${user.status === 'ACTIVE' ? 'bg-green-400' :
                                                        user.status === 'SUSPENDED' ? 'bg-red-400' : 'bg-gray-400'
                                                        }`} />
                                                    {user.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-400 text-sm">
                                                {new Date(user.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-end gap-2">
                                                    {user.status === 'ACTIVE' ? (
                                                        <button
                                                            onClick={() => updateStatus(user.id, 'SUSPENDED')}
                                                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                                            title="Suspend User"
                                                        >
                                                            <UserX className="w-5 h-5" />
                                                        </button>
                                                    ) : user.status === 'SUSPENDED' || user.status === 'INACTIVE' ? (
                                                        <button
                                                            onClick={() => updateStatus(user.id, 'ACTIVE')}
                                                            className="p-2 text-gray-400 hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-all"
                                                            title="Activate User"
                                                        >
                                                            <UserCheck className="w-5 h-5" />
                                                        </button>
                                                    ) : (
                                                        <span className="px-2 py-1 text-xs text-gray-500 border border-gray-700 rounded-md">
                                                            Deleted
                                                        </span>
                                                    )}
                                                    <button className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all">
                                                        <MoreHorizontal className="w-5 h-5" />
                                                    </button>
                                                    {user.status !== 'DELETED' && (
                                                        <button
                                                            onClick={() => updateStatus(user.id, 'DELETED')}
                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                            title="Delete User"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Add User Modal */}
            {showAddUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-gray-800">
                            <h2 className="text-xl font-bold text-white">Create New User</h2>
                        </div>
                        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">First Name</label>
                                    <input
                                        type="text"
                                        required
                                        autoComplete="given-name"
                                        className="w-full bg-gray-800 border-gray-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500"
                                        value={newUser.firstName}
                                        onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Last Name</label>
                                    <input
                                        type="text"
                                        required
                                        autoComplete="family-name"
                                        className="w-full bg-gray-800 border-gray-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500"
                                        value={newUser.lastName}
                                        onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    autoComplete="email"
                                    className="w-full bg-gray-800 border-gray-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
                                <input
                                    type="password"
                                    required
                                    minLength={8}
                                    autoComplete="new-password"
                                    className="w-full bg-gray-800 border-gray-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Role</label>
                                <select
                                    className="w-full bg-gray-800 border-gray-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500"
                                    value={newUser.role}
                                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                >
                                    <option value="SME">SME (Business Owner)</option>
                                    <option value="INVESTOR">Investor</option>
                                    <option value="ADVISOR">Advisor</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAddUserModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    Create User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}
