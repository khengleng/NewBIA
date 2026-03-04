'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Download,
  Handshake,
  FileText,
} from 'lucide-react'
import { API_URL, authorizedRequest } from '@/lib/api'

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: 'SME' | 'INVESTOR' | 'ADVISOR' | 'ADMIN' | 'SUPER_ADMIN' | 'FINOPS' | 'CX' | 'AUDITOR' | 'COMPLIANCE' | 'SUPPORT'
  tenantId: string
}

interface Report {
  id: number
  title: string
  type: string
  date: string
  status: string
  size: string
  description: string
}

interface Stat {
  title: string
  value: string
  change: string
  trend: 'up' | 'down'
  icon: typeof Handshake
}

export default function ReportsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reports, setReports] = useState<Report[]>([])
  const [stats, setStats] = useState<Stat[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userData = localStorage.getItem('user')
        if (!userData) {
          window.location.href = '/auth/login'
          return
        }

        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)

        // Fetch reports from API
        const reportsResponse = await authorizedRequest('/api/reports')

        if (reportsResponse.ok) {
          const reportsData = await reportsResponse.json()
          setReports(reportsData)
        }

        // Fetch stats from API
        const statsResponse = await authorizedRequest('/api/reports/stats')

        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          // Map API stats to include icons
          const iconMap: { [key: string]: typeof Handshake } = {
            'Total Deals': Handshake,
            'Active SMEs': Building2,
            'Total Investment': DollarSign,
            'Success Rate': TrendingUp
          }
          const mappedStats = (statsData.stats || []).map((stat: { title: string; value: string; change: string; trend: string }) => ({
            ...stat,
            icon: iconMap[stat.title] || Handshake
          }))
          setStats(mappedStats)
        } else {
          // Fallback to default stats if API fails
          setStats([
            { title: 'Total Deals', value: '0', change: '+0%', trend: 'up', icon: Handshake },
            { title: 'Active SMEs', value: '0', change: '+0%', trend: 'up', icon: Building2 },
            { title: 'Total Investment', value: '$0M', change: '+0%', trend: 'up', icon: DollarSign },
            { title: 'Success Rate', value: '0%', change: '0%', trend: 'up', icon: TrendingUp }
          ])
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDownloadReport = async (report: any) => {
    try {
      // Download report as PDF
      console.log(`Downloading report: ${report.title}`)
      const blob = new Blob([`${report.title}\n\n${report.description}\n\nGenerated: ${report.date}`], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${report.title.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading report:', error)
    }
  }

  const handleGenerateReport = async () => {
    try {
      setIsGenerating(true)

      const response = await authorizedRequest('/api/reports/generate', {
        method: 'POST',
        body: JSON.stringify({ reportType: 'Monthly Summary' })
      })

      if (response.ok) {
        const data = await response.json()
        // Add the new report to the list
        setReports(prev => [data.report, ...prev])
        console.log('Report generated successfully!')
      } else {
        const errorData = await response.json()
        console.error('Error generating report:', errorData.error)
        alert(errorData.error || 'Failed to generate report')
      }
    } catch (error) {
      console.error('Error generating report:', error)
    } finally {
      setIsGenerating(false)
    }
  }

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
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-white">Reports</h1>
            {/* Only ADMIN and ADVISOR can generate reports */}
            {(user?.role === 'ADMIN' || user?.role === 'ADVISOR') && (
              <button
                onClick={() => handleGenerateReport()}
                disabled={isGenerating}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center transition-colors"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Report
                  </>
                )}
              </button>
            )}
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => (
              <div key={index} className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">{stat.title}</p>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${stat.trend === 'up' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    <stat.icon className={`w-6 h-6 ${stat.trend === 'up' ? 'text-green-400' : 'text-red-400'}`} />
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  {stat.trend === 'up' ? (
                    <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-400 mr-1" />
                  )}
                  <span className={`text-sm ${stat.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                    {stat.change} from last month
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Reports List */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Recent Reports</h2>
            <div className="space-y-4">
              {reports.map((report) => (
                <div key={report.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <FileText className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{report.title}</h3>
                      <p className="text-gray-400 text-sm">{report.description}</p>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-gray-500 text-xs">{report.type}</span>
                        <span className="text-gray-500 text-xs">{report.size}</span>
                        <span className="text-gray-500 text-xs">{report.date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${report.status === 'Generated' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                      {report.status}
                    </span>
                    <button
                      onClick={() => handleDownloadReport(report)}
                      className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
    </DashboardLayout>
  )
}
