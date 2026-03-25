'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { authorizedRequest } from '@/lib/api'

interface OperatorUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
}

interface RolePermissionConfig {
  role: string
  config: {
    mode: 'extend' | 'replace'
    permissions: string[]
  }
}

interface CustomRoleConfig {
  code: string
  name: string
  baseRole: string
  description?: string
  permissions: string[]
  enabled: boolean
}

interface AbacPolicy {
  id?: string
  name: string
  resource: string
  action: string
  effect: 'ALLOW' | 'DENY'
  priority: number
  enabled: boolean
  config: {
    conditions: Array<{ field: string; op: string; value?: any }>
    description?: string
  }
}

export default function TradingOperatorRbacPage() {
  const [roles, setRoles] = useState<string[]>([])
  const [permissionCatalog, setPermissionCatalog] = useState<string[]>([])
  const [rolePermissionConfigs, setRolePermissionConfigs] = useState<RolePermissionConfig[]>([])
  const [rolePermissionRole, setRolePermissionRole] = useState('ADMIN')
  const [rolePermissionMode, setRolePermissionMode] = useState<'extend' | 'replace'>('replace')
  const [rolePermissionSelection, setRolePermissionSelection] = useState<string[]>([])
  const [rolePermissionSearch, setRolePermissionSearch] = useState('')
  const [customRoles, setCustomRoles] = useState<CustomRoleConfig[]>([])
  const [selectedCustomRoleCode, setSelectedCustomRoleCode] = useState('')
  const [customRoleDraft, setCustomRoleDraft] = useState<CustomRoleConfig>({
    code: '',
    name: '',
    baseRole: 'ADMIN',
    description: '',
    permissions: [],
    enabled: true
  })
  const [customRoleSearch, setCustomRoleSearch] = useState('')
  const [users, setUsers] = useState<OperatorUser[]>([])
  const [selectedUserForCustomRoles, setSelectedUserForCustomRoles] = useState('')
  const [selectedUserCustomRoles, setSelectedUserCustomRoles] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
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

  useEffect(() => {
    const loadRbac = async () => {
      const response = await authorizedRequest('/api/admin/rbac/overview')
      if (!response.ok) return
      const payload = await response.json()
      setRoles(payload.roles || [])
      const baseKeys = Array.isArray(payload.permissionKeys) ? payload.permissionKeys : []
      const ownerKeys = baseKeys.map((key: string) => `${key}:owner`)
      setPermissionCatalog([...baseKeys, ...ownerKeys])
      if (Array.isArray(payload.roles) && payload.roles.length > 0) {
        setRolePermissionRole(payload.roles[0])
      }
    }

    const loadRolePermissions = async () => {
      const response = await authorizedRequest('/api/admin/role-permissions')
      if (!response.ok) return
      const payload = await response.json()
      setRolePermissionConfigs(payload.configs || [])
    }

    const loadCustomRoles = async () => {
      const response = await authorizedRequest('/api/admin/custom-roles')
      if (!response.ok) return
      const payload = await response.json()
      setCustomRoles(payload.roles || [])
    }

    const loadUsers = async () => {
      const response = await authorizedRequest('/api/admin/users')
      if (!response.ok) return
      const payload = await response.json()
      setUsers(payload.users || [])
    }

    const loadAbacPolicies = async () => {
      const response = await authorizedRequest('/api/admin/abac-policies')
      if (!response.ok) return
      const payload = await response.json()
      if (Array.isArray(payload.policies)) {
        setAbacPolicies(payload.policies)
        if (payload.policies.length > 0 && !selectedAbacPolicyId) {
          setSelectedAbacPolicyId(payload.policies[0].id)
          setAbacDraft(payload.policies[0])
          setAbacConditionsJson(JSON.stringify(payload.policies[0].config?.conditions || [], null, 2))
        }
      }
    }

    void loadRbac()
    void loadRolePermissions()
    void loadCustomRoles()
    void loadUsers()
    void loadAbacPolicies()
  }, [])

  useEffect(() => {
    const config = rolePermissionConfigs.find((item) => item.role === rolePermissionRole)
    if (config) {
      setRolePermissionMode(config.config.mode)
      setRolePermissionSelection(config.config.permissions || [])
    }
  }, [rolePermissionConfigs, rolePermissionRole])

  useEffect(() => {
    if (!selectedCustomRoleCode) return
    const role = customRoles.find((item) => item.code === selectedCustomRoleCode)
    if (role) setCustomRoleDraft(role)
  }, [customRoles, selectedCustomRoleCode])

  useEffect(() => {
    if (selectedCustomRoleCode) return
    setCustomRoleDraft({
      code: '',
      name: '',
      baseRole: 'ADMIN',
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
    const loadUserCustomRoles = async () => {
      const response = await authorizedRequest(`/api/admin/users/${selectedUserForCustomRoles}/custom-roles`)
      if (!response.ok) return
      const payload = await response.json()
      setSelectedUserCustomRoles(payload.roleCodes || [])
    }
    void loadUserCustomRoles()
  }, [selectedUserForCustomRoles])

  const saveRolePermissions = async () => {
    setIsSaving(true)
    await authorizedRequest(`/api/admin/role-permissions/${rolePermissionRole}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: rolePermissionMode,
        permissions: rolePermissionSelection
      })
    })
    setIsSaving(false)
  }

  const saveCustomRole = async () => {
    setIsSaving(true)
    const endpoint = selectedCustomRoleCode ? `/api/admin/custom-roles/${selectedCustomRoleCode}` : '/api/admin/custom-roles'
    const method = selectedCustomRoleCode ? 'PUT' : 'POST'
    const response = await authorizedRequest(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customRoleDraft)
    })
    if (response.ok) {
      const payload = await response.json()
      const role = payload.role
      setCustomRoles((prev) => {
        const exists = prev.find((item) => item.code === role.code)
        if (exists) return prev.map((item) => (item.code === role.code ? role : item))
        return [...prev, role]
      })
      setSelectedCustomRoleCode(role.code)
      setCustomRoleDraft(role)
    }
    setIsSaving(false)
  }

  const saveUserCustomRoles = async () => {
    if (!selectedUserForCustomRoles) return
    setIsSaving(true)
    await authorizedRequest(`/api/admin/users/${selectedUserForCustomRoles}/custom-roles`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleCodes: selectedUserCustomRoles })
    })
    setIsSaving(false)
  }

  const saveAbacPolicy = async () => {
    setIsSaving(true)
    let conditions: Array<{ field: string; op: string; value?: any }> = []
    try {
      const parsed = JSON.parse(abacConditionsJson || '[]')
      if (Array.isArray(parsed)) {
        conditions = parsed
      }
    } catch (error) {
      setIsSaving(false)
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
        if (existing) return prev.map((item) => (item.id === policy.id ? policy : item))
        return [...prev, policy]
      })
      setSelectedAbacPolicyId(policy.id || '')
      setAbacDraft(policy)
      setAbacConditionsJson(JSON.stringify(policy.config?.conditions || [], null, 2))
    }
    setIsSaving(false)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h1 className="text-3xl font-bold text-white">Trading RBAC Configuration</h1>
          <p className="text-gray-400 mt-2">Manage operator permissions and sub-roles for the trading exchange.</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
          <h2 className="text-xl text-white font-semibold">Role Permission Overrides</h2>
          <div className="grid md:grid-cols-4 gap-3">
            <select
              className="bg-gray-900 border-gray-700 rounded-xl text-white px-3 py-2"
              value={rolePermissionRole}
              onChange={(e) => setRolePermissionRole(e.target.value)}
            >
              {roles.map((role) => (
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
            {permissionCatalog.filter((permission) =>
              permission.toLowerCase().includes(rolePermissionSearch.toLowerCase())
            ).map((permission) => (
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
          <button
            onClick={saveRolePermissions}
            disabled={isSaving}
            className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            {isSaving ? 'Saving...' : 'Save Role Permissions'}
          </button>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
          <h2 className="text-xl text-white font-semibold">Custom Roles</h2>
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
              {roles.map((role) => (
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
            {permissionCatalog.filter((permission) =>
              permission.toLowerCase().includes(customRoleSearch.toLowerCase())
            ).map((permission) => (
              <label key={permission} className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={customRoleDraft.permissions.includes(permission)}
                  onChange={(e) => {
                    setCustomRoleDraft((prev) => {
                      if (e.target.checked) return { ...prev, permissions: [...prev.permissions, permission] }
                      return { ...prev, permissions: prev.permissions.filter((item) => item !== permission) }
                    })
                  }}
                />
                <span>{permission}</span>
              </label>
            ))}
          </div>
          <button
            onClick={saveCustomRole}
            disabled={isSaving}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            {isSaving ? 'Saving...' : 'Save Custom Role'}
          </button>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
          <h2 className="text-xl text-white font-semibold">Assign Custom Roles</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <select
              className="bg-gray-900 border-gray-700 rounded-xl text-white px-3 py-2 md:col-span-2"
              value={selectedUserForCustomRoles}
              onChange={(e) => setSelectedUserForCustomRoles(e.target.value)}
            >
              <option value="">Select operator</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.email})
                </option>
              ))}
            </select>
            <button
              onClick={saveUserCustomRoles}
              disabled={isSaving || !selectedUserForCustomRoles}
              className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              {isSaving ? 'Saving...' : 'Save Assignments'}
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

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
          <h2 className="text-xl text-white font-semibold">ABAC Policy Editor</h2>
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
              placeholder="Resource (e.g., secondary_trading)"
              value={abacDraft.resource}
              onChange={(e) => setAbacDraft({ ...abacDraft, resource: e.target.value })}
            />
            <input
              className="bg-gray-900 border border-gray-700 rounded-xl text-white px-3 py-2"
              placeholder="Action (e.g., create_listing)"
              value={abacDraft.action}
              onChange={(e) => setAbacDraft({ ...abacDraft, action: e.target.value })}
            />
            <input
              className="bg-gray-900 border border-gray-700 rounded-xl text-white px-3 py-2"
              placeholder="Priority"
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
          </div>
          <div className="flex justify-end">
            <button
              onClick={saveAbacPolicy}
              disabled={isSaving}
              className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            >
              {isSaving ? 'Saving...' : 'Save ABAC Policy'}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
