'use client'

import { useState, useEffect } from 'react'
import {
    Palette,
    Upload,
    Globe,
    Type,
    Save,
    RefreshCcw,
    Check
} from 'lucide-react'
import DashboardLayout from '../../../../components/layout/DashboardLayout'
import { authorizedRequest } from '../../../../lib/api'
import { toast } from 'react-hot-toast'

export default function BrandingSettingsPage() {
    const [settings, setSettings] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [formData, setFormData] = useState({
        platformName: '',
        logoUrl: '',
        primaryColor: '#3b82f6',
        secondaryColor: '#1e293b',
        emailHeader: '',
        emailFooter: ''
    })

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            setIsLoading(true);
            const response = await authorizedRequest('/api/admin/tenant/settings')
            if (response.ok) {
                const data = await response.json()
                setSettings(data.settings)
                if (data.settings?.branding) {
                    setFormData({
                        platformName: data.settings.branding.platformName || '',
                        logoUrl: data.settings.branding.logoUrl || '',
                        primaryColor: data.settings.branding.primaryColor || '#3b82f6',
                        secondaryColor: data.settings.branding.secondaryColor || '#1e293b',
                        emailHeader: data.settings.branding.emailHeader || '',
                        emailFooter: data.settings.branding.emailFooter || ''
                    })
                }
            }
        } catch (error) {
            console.error('Error fetching settings:', error)
            toast.error('Failed to load branding settings')
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const response = await authorizedRequest('/api/admin/tenant/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ branding: formData })
            })

            if (response.ok) {
                toast.success('Branding settings updated successfully');
                // Force a refresh of the page or update global state if needed
            } else {
                toast.error('Failed to update settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Error saving settings');
        } finally {
            setIsSaving(false);
        }
    }

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-64">
                    <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="space-y-8 max-w-4xl mx-auto">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Palette className="w-8 h-8 text-blue-400" />
                        Platform Branding
                    </h1>
                    <p className="text-gray-400 mt-2">Customize the look and feel of your portal for all users.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Visual Settings */}
                    <div className="space-y-6">
                        <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-2xl backdrop-blur-xl">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <Globe className="w-5 h-5 text-green-400" />
                                Visual Identity
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Platform Name</label>
                                    <input
                                        type="text"
                                        value={formData.platformName}
                                        onChange={(e) => setFormData({ ...formData, platformName: e.target.value })}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        placeholder="Boutique Advisory Platform"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Logo URL</label>
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            value={formData.logoUrl}
                                            onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                                            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-600"
                                            placeholder="https://example.com/logo.png"
                                        />
                                        <button className="bg-gray-700 hover:bg-gray-600 p-3 rounded-xl transition-all">
                                            <Upload className="w-5 h-5 text-gray-300" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Primary Color</label>
                                        <div className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2">
                                            <input
                                                type="color"
                                                value={formData.primaryColor}
                                                onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                                                className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                                            />
                                            <span className="text-sm text-gray-300 font-mono uppercase">{formData.primaryColor}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Secondary Color</label>
                                        <div className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2">
                                            <input
                                                type="color"
                                                value={formData.secondaryColor}
                                                onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                                                className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                                            />
                                            <span className="text-sm text-gray-300 font-mono uppercase">{formData.secondaryColor}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Preview Card */}
                        <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-2xl">
                            <h3 className="text-gray-400 text-sm font-medium mb-4 uppercase tracking-wider">Button Preview</h3>
                            <div className="flex flex-wrap gap-4">
                                <button
                                    style={{ backgroundColor: formData.primaryColor }}
                                    className="px-6 py-2 rounded-xl text-white font-bold shadow-lg"
                                >
                                    Primary Action
                                </button>
                                <button
                                    style={{ borderColor: formData.primaryColor, color: formData.primaryColor }}
                                    className="px-6 py-2 rounded-xl border font-bold"
                                >
                                    Outline Action
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Content & Messaging */}
                    <div className="space-y-6">
                        <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-2xl backdrop-blur-xl">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <Type className="w-5 h-5 text-purple-400" />
                                Email & Messaging
                            </h2>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Email Header Text</label>
                                    <textarea
                                        value={formData.emailHeader}
                                        onChange={(e) => setFormData({ ...formData, emailHeader: e.target.value })}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all h-24"
                                        placeholder="Welcome to our premium advisory portal..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Email Footer Text</label>
                                    <textarea
                                        value={formData.emailFooter}
                                        onChange={(e) => setFormData({ ...formData, emailFooter: e.target.value })}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all h-24"
                                        placeholder="© 2024 Your Company. Contact support@example.com"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-2xl flex items-start gap-4">
                            <div className="bg-blue-500/20 p-2 rounded-lg">
                                <Save className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h4 className="text-white font-bold">Safe Mode</h4>
                                <p className="text-gray-400 text-sm mt-1">Changes are applied immediately to all tenant users but can be reverted anytime.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-4 border-t border-gray-800 pt-8">
                    <button
                        onClick={fetchSettings}
                        className="px-8 py-3 rounded-xl border border-gray-700 text-gray-300 font-bold hover:bg-gray-800 transition-all flex items-center gap-2"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        Reset Changes
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-10 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold transition-all shadow-xl shadow-blue-900/40 flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {isSaving ? 'Saving...' : 'Save Branding'}
                    </button>
                </div>
            </div>
        </DashboardLayout>
    )
}
