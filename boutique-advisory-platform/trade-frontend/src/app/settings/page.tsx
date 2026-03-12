'use client'
import { authorizedRequest } from '@/lib/api'
import { hasPermission } from '@/lib/permissions'
import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import {
  LogOut,
  User,
  Shield,
  Bell as BellIcon,
  Globe,
  Save,
} from 'lucide-react'
import TelegramLink from '../../components/TelegramLink'

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: 'SME' | 'INVESTOR' | 'ADVISOR' | 'ADMIN' | 'SUPER_ADMIN' | 'FINOPS' | 'CX' | 'AUDITOR' | 'COMPLIANCE' | 'SUPPORT'
  tenantId: string
  twoFactorEnabled?: boolean
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('profile')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // 2FA State
  const [is2faEnabled, setIs2faEnabled] = useState(false)
  const [show2faModal, setShow2faModal] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [disablePassword, setDisablePassword] = useState('')
  const [showDisableModal, setShowDisableModal] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false)

  // Delete Account State
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Preferences State
  const [preferences, setPreferences] = useState({
    language: 'EN',
    timezone: 'UTC+7',
    currency: 'USD'
  })

  const isOperator = !!user?.role && hasPermission(user.role, 'admin.read')
  const securityPageTitle = user?.role === 'SUPER_ADMIN' ? 'Superadmin Security Center' : isOperator ? 'Operator Security Center' : 'Settings'
  const securityPageSubtitle = isOperator
    ? 'Manage privileged account security, MFA, sessions, and platform operator preferences.'
    : 'Manage your account settings and preferences'
  const profileHeading = isOperator ? 'Operator Profile' : 'Profile Information'
  const securityHeading = isOperator ? 'Operator Security Controls' : 'Security Settings'
  const passwordHeading = isOperator ? 'Update Operator Password' : 'Change Password'
  const twoFactorHeading = isOperator ? 'Privileged Account MFA / 2FA' : 'Two-Factor Authentication (2FA)'
  const twoFactorEnabledTitle = isOperator ? 'Operator MFA is Enabled' : '2FA is Enabled'
  const twoFactorEnabledDescription = isOperator
    ? 'Your privileged operator account is protected with an authenticator app.'
    : 'Your account is secured with an authenticator app.'
  const twoFactorDisabledDescription = isOperator
    ? 'Protect this operator account with an extra authentication factor before accessing platform controls.'
    : 'Protect your account with an extra layer of security.'
  const twoFactorDisabledSubtext = isOperator
    ? 'Require a code from your mobile device before privileged actions and sign-in.'
    : 'Require a code from your mobile device to sign in.'
  const notificationsHeading = isOperator ? 'Operator Notification Preferences' : 'Notification Preferences'
  const preferencesHeading = isOperator ? 'Operator Preferences' : 'General Preferences'

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match')
      return
    }

    if (newPassword.length < 12) {
      alert('Password must be at least 12 characters long')
      return
    }

    try {
      const response = await authorizedRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      })

      const data = await response.json()

      if (response.ok) {
        alert('Password updated successfully!')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        alert(data.error || 'Failed to update password')
      }
    } catch (error) {
      console.error('Error updating password:', error)
      alert('An error occurred while updating password')
    }
  }

  const handleEnable2FA = async () => {
    try {
      const response = await authorizedRequest('/api/auth/2fa/setup', {
        method: 'POST'
      })

      const data = await response.json()
      if (response.ok) {
        setQrCode(data.qrCode)
        setSecret(data.secret)
        setShow2faModal(true)
      } else {
        alert(data.error || 'Failed to start 2FA setup')
      }
    } catch (error) {
      console.error('Error setting up 2FA:', error)
    }
  }

  const handleVerify2FA = async () => {
    try {
      const response = await authorizedRequest('/api/auth/2fa/activate', {
        method: 'POST',
        body: JSON.stringify({ code: verificationCode, secret })
      })

      const data = await response.json()

      if (response.ok) {
        setIs2faEnabled(true)
        setShow2faModal(false)
        setVerificationCode('')

        if (data.backupCodes) {
          setBackupCodes(data.backupCodes)
          setShowBackupCodesModal(true)
        } else {
          alert('Two-Factor Authentication Enabled Successfully!')
        }

        // Update local user object
        if (user) {
          const updatedUser = { ...user, twoFactorEnabled: true }
          setUser(updatedUser)
          localStorage.setItem('user', JSON.stringify(updatedUser))
        }
      } else {
        alert(data.error || 'Invalid code')
      }
    } catch (error) {
      console.error('Error activating 2FA:', error)
    }
  }

  const handleDisable2FA = async () => {
    try {
      const response = await authorizedRequest('/api/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ password: disablePassword })
      })

      if (response.ok) {
        setIs2faEnabled(false)
        setShowDisableModal(false)
        setDisablePassword('')
        alert('Two-Factor Authentication Disabled')

        // Update local user object
        if (user) {
          const updatedUser = { ...user, twoFactorEnabled: false }
          setUser(updatedUser)
          localStorage.setItem('user', JSON.stringify(updatedUser))
        }

      } else {
        const data = await response.json()
        alert(data.error || 'Failed to disable 2FA')
      }
    } catch (error) {
      console.error('Error disabling 2FA:', error)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      return
    }

    setIsDeleting(true)
    try {
      const response = await authorizedRequest('/api/auth/delete-account', {
        method: 'POST'
      })

      if (response.ok) {
        // Show success message
        alert('Your account has been successfully deleted.')

        // Clear local storage
        localStorage.removeItem('user')

        // Build URL relative to window location if possible, or just redirect
        window.location.href = '/'
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete account')
        setIsDeleting(false)
      }
    } catch (error) {
      console.error('Error deleting account:', error)
      alert('An error occurred while deleting your account')
      setIsDeleting(false)
    }
  }



  const handleSavePreferences = async () => {
    try {
      const response = await authorizedRequest('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          language: preferences.language,
          preferences: {
            timezone: preferences.timezone,
            currency: preferences.currency
          }
        })
      })

      if (response.ok) {
        const updatedUser = await response.json()
        setUser(updatedUser)
        localStorage.setItem('user', JSON.stringify(updatedUser))
        alert('Preferences saved successfully!')
      } else {
        alert('Failed to save preferences')
      }
    } catch (error) {
      console.error('Error saving preferences:', error)
      alert('An error occurred')
    }
  }

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const meResponse = await authorizedRequest('/api/auth/me')

        if (!meResponse.ok) {
          window.location.href = '/auth/login'
          return
        }

        const meData = await meResponse.json()
        const currentUser = meData.user || null

        if (!currentUser) {
          window.location.href = '/auth/login'
          return
        }

        setUser(currentUser)
        localStorage.setItem('user', JSON.stringify(currentUser))

        // Load preferences if available
        if (currentUser.preferences) {
          setPreferences(prev => ({ ...prev, ...currentUser.preferences }))
        }
        if (currentUser.language) {
          setPreferences(prev => ({ ...prev, language: currentUser.language }))
        }

        if (currentUser.twoFactorEnabled !== undefined) {
          setIs2faEnabled(currentUser.twoFactorEnabled)
        } else {
          setIs2faEnabled(false)
        }
      } catch (error) {
        console.error('Error fetching user:', error)
        window.location.href = '/auth/login'
      } finally {
        setIsLoading(false)
      }
    }

    fetchUser()
  }, [])

  const handleSaveProfile = async () => {
    // Placeholder for profile save
    alert('Profile update placeholder')
  }

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
    { id: 'preferences', name: 'Preferences', icon: Globe }
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <main>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">{securityPageTitle}</h1>
          <p className="text-gray-400 mt-2">{securityPageSubtitle}</p>
        </div>

        <div className="bg-gray-800 rounded-lg">
          <div className="border-b border-gray-700">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                    }`}
                >
                  <tab.icon className="w-5 h-5 mr-2" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white">{profileHeading}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">First Name</label>
                    <input
                      type="text"
                      defaultValue={user?.firstName}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Last Name</label>
                    <input
                      type="text"
                      defaultValue={user?.lastName}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                    <input
                      type="email"
                      defaultValue={user?.email}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                    <input
                      type="text"
                      defaultValue={user?.role}
                      disabled
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-gray-400 cursor-not-allowed"
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleSaveProfile()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </button>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white">{securityHeading}</h2>

                {/* Password Section */}
                <form
                  className="bg-gray-800 p-6 rounded-lg border border-gray-700"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void handleUpdatePassword()
                  }}
                >
                  <input
                    type="text"
                    name="username"
                    value={user?.email || ''}
                    autoComplete="username"
                    readOnly
                    tabIndex={-1}
                    aria-hidden="true"
                    className="sr-only"
                  />
                  <h3 className="text-lg font-medium text-white mb-4">{passwordHeading}</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Current Password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        autoComplete="current-password"
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                    >
                      Update Password
                    </button>
                  </div>
                </form>

                {/* 2FA Section */}
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-400" />
                    {twoFactorHeading}
                  </h3>

                  {is2faEnabled ? (
                    <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/20 rounded-full">
                          <Shield className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{twoFactorEnabledTitle}</p>
                          <p className="text-sm text-gray-400">{twoFactorEnabledDescription}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowDisableModal(true)}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-colors"
                      >
                        Disable
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-gray-700/30 p-4 rounded-lg">
                      <div>
                        <p className="text-gray-300">{twoFactorDisabledDescription}</p>
                        <p className="text-sm text-gray-500">{twoFactorDisabledSubtext}</p>
                      </div>
                      <button
                        onClick={handleEnable2FA}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        Enable 2FA
                      </button>
                    </div>
                  )}
                </div>

                {/* Telegram Bot Integration */}
                <TelegramLink user={user} />

                {/* Danger Zone - Delete Account */}
                <div className="bg-red-900/10 border border-red-500/20 p-6 rounded-lg mt-8">
                  <h3 className="text-lg font-medium text-red-400 mb-2 flex items-center gap-2">
                    <LogOut className="w-5 h-5" />
                    Danger Zone
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Once you delete your account, there is no going back. Please be certain.
                  </p>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Delete Account</p>
                      <p className="text-sm text-gray-500">Permanently remove your account and all of its content.</p>
                    </div>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-sm"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white">{notificationsHeading}</h2>
                <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                  {[
                    {
                      id: 'deals',
                      title: 'Deal Updates',
                      description: 'Receive notifications about new deals, status changes, and investments.',
                    },
                    {
                      id: 'messages',
                      title: 'Messages',
                      description: 'Get notified when you receive a new message or reply.',
                    },
                    {
                      id: 'security',
                      title: 'Security Alerts',
                      description: 'Important notifications about your account security and login attempts.',
                    },
                    {
                      id: 'marketing',
                      title: 'Marketing & News',
                      description: 'Receive updates about platform features, newsletters, and promotions.',
                    }
                  ].map((item) => (
                    <div key={item.id} className="p-6 border-b border-gray-700 last:border-0 flex items-start justify-between">
                      <div>
                        <h3 className="text-white font-medium">{item.title}</h3>
                        <p className="text-gray-400 text-sm mt-1">{item.description}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center cursor-pointer">
                          <div className="relative">
                            <input type="checkbox" className="sr-only peer" defaultChecked={true} />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </div>
                          <span className="ml-3 text-sm font-medium text-gray-300">Email</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                          <div className="relative">
                            <input type="checkbox" className="sr-only peer" defaultChecked={item.id !== 'marketing'} />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </div>
                          <span className="ml-3 text-sm font-medium text-gray-300">Push</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg" onClick={() => alert('Preferences saved!')}>
                    Save Preferences
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'preferences' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white">{preferencesHeading}</h2>

                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Language</label>
                    <select
                      value={preferences.language}
                      onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="EN">English (US)</option>
                      <option value="KM">Khmer (ភាសាខ្មែរ)</option>
                      <option value="ZH">Chinese (中文)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Select the language for the platform interface.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Timezone</label>
                    <select
                      value={preferences.timezone}
                      onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="UTC+7">Indochina Time (ICT) - UTC+07:00</option>
                      <option value="UTC+0">Coordinated Universal Time (UTC)</option>
                      <option value="UTC+8">Singapore Standard Time (SST) - UTC+08:00</option>
                      <option value="UTC-5">Eastern Standard Time (EST) - UTC-05:00</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Currency Display</label>
                    <select
                      value={preferences.currency}
                      onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="KHR">KHR (៛)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Preferred currency for financial reports and deal values.</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSavePreferences}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Enable 2FA Modal */}
      {
        show2faModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-2xl max-w-md w-full border border-gray-700 shadow-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Set up 2FA</h3>

              <div className="space-y-6">
                <div className="flex justify-center bg-white p-4 rounded-xl">
                  <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                </div>

                <div className="text-center space-y-2">
                  <p className="text-gray-300 text-sm">1. Scan this QR code with your authenticator app</p>
                  <p className="text-gray-300 text-sm">2. Enter the 6-digit code below to verify.</p>
                </div>

                <input
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center text-3xl tracking-[0.5em] py-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-600"
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => setShow2faModal(false)}
                    className="flex-1 py-3 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVerify2FA}
                    disabled={verificationCode.length !== 6}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Verify & Enable
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Disable 2FA Modal */}
      {
        showDisableModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-2xl max-w-sm w-full border border-gray-700 shadow-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-2">Disable 2FA?</h3>
              <p className="text-gray-400 text-sm mb-6">Are you sure? This will decrease your account security.</p>

              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  void handleDisable2FA()
                }}
              >
                <input
                  type="text"
                  name="username"
                  value={user?.email || ''}
                  autoComplete="username"
                  readOnly
                  tabIndex={-1}
                  aria-hidden="true"
                  className="sr-only"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDisableModal(false)}
                    className="flex-1 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
                  >
                    Disable 2FA
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Backup Codes Modal */}
      {
        showBackupCodesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-2xl max-w-md w-full border border-gray-700 shadow-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Backup Codes</h3>
              <p className="text-gray-300 text-sm mb-4">
                Save these backup codes in a safe place. You can use them to log in if you lose access to your authenticator app.
                Each code can only be used once.
              </p>
              <div className="bg-gray-900 p-4 rounded-lg grid grid-cols-2 gap-2 mb-6">
                {backupCodes.map((code, index) => (
                  <code key={index} className="text-blue-400 font-mono text-center block bg-gray-800/50 p-1 rounded">
                    {code}
                  </code>
                ))}
              </div>
              <button
                onClick={() => setShowBackupCodesModal(false)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                I have saved these codes
              </button>
            </div>
          </div>
        )
      }

      {/* Delete Account Modal */}
      {
        showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-2xl max-w-md w-full border border-red-500/30 shadow-2xl p-6">
              <div className="flex items-center gap-3 mb-4 text-red-400">
                <LogOut className="w-6 h-6" />
                <h3 className="text-xl font-bold">Delete Account?</h3>
              </div>

              <p className="text-gray-300 text-sm mb-6">
                This action cannot be undone. This will permanently delete your account,
                remove your data from our servers, and cancel your active subscriptions.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Type <span className="font-mono font-bold text-white">DELETE</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false)
                      setDeleteConfirmation('')
                    }}
                    disabled={isDeleting}
                    className="flex-1 py-3 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmation !== 'DELETE' || isDeleting}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                  >
                    {isDeleting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      'Delete Account'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </DashboardLayout>
  )
}
