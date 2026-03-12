'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import NotificationCenter from '../../components/NotificationCenter'

export default function NotificationsPage() {
    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-white">Notifications</h1>
                </div>

                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 min-h-[400px]">
                    <p className="text-gray-400 text-center py-8">
                        View and manage all your notifications here.
                    </p>
                    {/* Reusing the NotificationCenter logic but expanded would be ideal.
                        For now, we can just show a placeholder or embed the dropdown content as a full list.
                        Since NotificationCenter is built as a dropdown, we might want to refactor it or create a separate list component.
                        For this quick fix, let's just render a simple state message or basic list.
                    */}
                    <div className="flex justify-center">
                        <NotificationCenter />
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
