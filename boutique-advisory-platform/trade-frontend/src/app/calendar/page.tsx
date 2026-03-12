'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    Calendar,
    Clock,
    Plus,
    ChevronLeft,
    ChevronRight,
    Video,
    MapPin,
    Users,
    ExternalLink,
    Edit,
    Trash2,
    X,
    Check,
    Filter
} from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useToast } from '../../contexts/ToastContext'
import { authorizedRequest } from '@/lib/api'

interface Attendee {
    id: string
    name: string
    role: string
    status: 'ACCEPTED' | 'PENDING' | 'DECLINED'
}

interface CalendarEvent {
    id: string
    title: string
    description: string
    type: string
    startTime: string
    endTime: string
    location: string
    meetingLink: string | null
    attendees: Attendee[]
    dealId: string | null
    status: string
    color: string
    createdAt: string
}

export default function CalendarPage() {
    const { addToast } = useToast()
    const [events, setEvents] = useState<CalendarEvent[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [viewMode, setViewMode] = useState<'week' | 'month' | 'list'>('week')
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [filterType, setFilterType] = useState('all')
    const [createForm, setCreateForm] = useState({
        title: '',
        description: '',
        type: 'GENERAL',
        startTime: '',
        endTime: '',
        location: 'Virtual',
        meetingLink: ''
    })

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const userData = localStorage.getItem('user')

                if (!userData) {
                    window.location.href = '/auth/login'
                    return
                }

                const response = await authorizedRequest('/api/calendar')

                if (response.ok) {
                    const data = await response.json()
                    setEvents(data.events || [])
                }
            } catch (error) {
                console.error('Error fetching calendar:', error)
                addToast('error', 'Failed to load calendar')
            } finally {
                setIsLoading(false)
            }
        }

        fetchEvents()
    }, [addToast])

    const handleCreateEvent = async () => {
        if (!createForm.title || !createForm.startTime || !createForm.endTime) {
            addToast('error', 'Please fill in required fields')
            return
        }

        try {
            const response = await authorizedRequest('/api/calendar', {
                method: 'POST',
                body: JSON.stringify(createForm)
            })

            if (response.ok) {
                const newEvent = await response.json()
                setEvents(prev => [...prev, newEvent])
                addToast('success', 'Event created successfully')
                setShowCreateModal(false)
                setCreateForm({
                    title: '',
                    description: '',
                    type: 'GENERAL',
                    startTime: '',
                    endTime: '',
                    location: 'Virtual',
                    meetingLink: ''
                })
            }
        } catch (error) {
            console.error('Error creating event:', error)
            addToast('error', 'Failed to create event')
        }
    }

    const handleDeleteEvent = async (eventId: string) => {
        try {
            const response = await authorizedRequest(`/api/calendar/${eventId}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                setEvents(prev => prev.filter(e => e.id !== eventId))
                setSelectedEvent(null)
                addToast('success', 'Event deleted')
            }
        } catch (error) {
            console.error('Error deleting event:', error)
            addToast('error', 'Failed to delete event')
        }
    }

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        })
    }

    const getEventTypeLabel = (type: string) => {
        switch (type) {
            case 'PITCH_SESSION': return 'Pitch Session'
            case 'DUE_DILIGENCE': return 'Due Diligence'
            case 'NEGOTIATION': return 'Negotiation'
            case 'CLOSING': return 'Closing'
            default: return 'General'
        }
    }

    const filteredEvents = events.filter(e =>
        filterType === 'all' || e.type === filterType
    )

    const upcomingEvents = filteredEvents
        .filter(e => new Date(e.startTime) > new Date())
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

    // Get days for week view
    const getWeekDays = () => {
        const days = []
        const startOfWeek = new Date(selectedDate)
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())

        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek)
            day.setDate(day.getDate() + i)
            days.push(day)
        }
        return days
    }

    const getEventsForDay = (date: Date) => {
        return filteredEvents.filter(e => {
            const eventDate = new Date(e.startTime)
            return eventDate.toDateString() === date.toDateString()
        })
    }

    const navigateWeek = (direction: 'prev' | 'next') => {
        const newDate = new Date(selectedDate)
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
        setSelectedDate(newDate)
    }

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Calendar className="w-8 h-8 text-blue-400" />
                        Calendar & Scheduling
                    </h1>
                    <p className="text-gray-400 mt-1">Manage pitch sessions, meetings, and appointments</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Event
                </button>
            </div>

            {/* Controls */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigateWeek('prev')}
                        className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-white" />
                    </button>
                    <h2 className="text-xl font-semibold text-white">
                        {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h2>
                    <button
                        onClick={() => navigateWeek('next')}
                        className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                        <ChevronRight className="w-5 h-5 text-white" />
                    </button>
                    <button
                        onClick={() => setSelectedDate(new Date())}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                    >
                        Today
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                    >
                        <option value="all">All Events</option>
                        <option value="PITCH_SESSION">Pitch Sessions</option>
                        <option value="DUE_DILIGENCE">Due Diligence</option>
                        <option value="NEGOTIATION">Negotiation</option>
                        <option value="CLOSING">Closing</option>
                    </select>

                    <div className="flex bg-gray-700 rounded-lg p-1">
                        {['week', 'list'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode as 'week' | 'list')}
                                className={`px-3 py-1 rounded text-sm capitalize ${viewMode === mode
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex gap-6">
                {/* Main Calendar Area */}
                <div className="flex-1">
                    {viewMode === 'week' ? (
                        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                            {/* Week Header */}
                            <div className="grid grid-cols-7 border-b border-gray-700">
                                {getWeekDays().map((day, index) => (
                                    <div
                                        key={index}
                                        className={`p-4 text-center border-r border-gray-700 last:border-r-0 ${day.toDateString() === new Date().toDateString()
                                            ? 'bg-blue-600/20'
                                            : ''
                                            }`}
                                    >
                                        <p className="text-sm text-gray-400">
                                            {day.toLocaleDateString('en-US', { weekday: 'short' })}
                                        </p>
                                        <p className={`text-2xl font-bold ${day.toDateString() === new Date().toDateString()
                                            ? 'text-blue-400'
                                            : 'text-white'
                                            }`}>
                                            {day.getDate()}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* Week Body */}
                            <div className="grid grid-cols-7 min-h-[400px]">
                                {getWeekDays().map((day, index) => {
                                    const dayEvents = getEventsForDay(day)
                                    return (
                                        <div
                                            key={index}
                                            className="border-r border-gray-700 last:border-r-0 p-2 min-h-[200px]"
                                        >
                                            {dayEvents.map(event => (
                                                <div
                                                    key={event.id}
                                                    onClick={() => setSelectedEvent(event)}
                                                    className="mb-2 p-2 rounded-lg cursor-pointer text-white text-sm hover:opacity-80 transition-opacity"
                                                    style={{ backgroundColor: event.color }}
                                                >
                                                    <p className="font-medium truncate">{event.title}</p>
                                                    <p className="text-xs opacity-80">
                                                        {formatTime(event.startTime)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        /* List View */
                        <div className="space-y-4">
                            {upcomingEvents.length === 0 ? (
                                <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
                                    <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-500" />
                                    <p className="text-xl text-gray-400">No upcoming events</p>
                                    <p className="text-sm text-gray-500 mt-1">Create a new event to get started</p>
                                </div>
                            ) : (
                                upcomingEvents.map(event => (
                                    <div
                                        key={event.id}
                                        onClick={() => setSelectedEvent(event)}
                                        className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div
                                                className="w-1 h-full min-h-[80px] rounded-full"
                                                style={{ backgroundColor: event.color }}
                                            />
                                            <div className="flex-1">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <h3 className="text-lg font-semibold text-white">{event.title}</h3>
                                                        <p className="text-gray-400 text-sm mt-1">{event.description}</p>
                                                    </div>
                                                    <span
                                                        className="px-2 py-1 rounded text-xs text-white"
                                                        style={{ backgroundColor: event.color }}
                                                    >
                                                        {getEventTypeLabel(event.type)}
                                                    </span>
                                                </div>

                                                <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-400">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="w-4 h-4" />
                                                        <span>{formatDate(event.startTime)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="w-4 h-4" />
                                                        <span>{formatTime(event.startTime)} - {formatTime(event.endTime)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <MapPin className="w-4 h-4" />
                                                        <span>{event.location}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Users className="w-4 h-4" />
                                                        <span>{event.attendees.length} attendees</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar - Today's Events */}
                <div className="w-80">
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <h3 className="font-semibold text-white mb-4">Today&apos;s Schedule</h3>
                        <div className="space-y-3">
                            {getEventsForDay(new Date()).length === 0 ? (
                                <p className="text-gray-400 text-sm text-center py-4">No events today</p>
                            ) : (
                                getEventsForDay(new Date()).map(event => (
                                    <div
                                        key={event.id}
                                        onClick={() => setSelectedEvent(event)}
                                        className="p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <div
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: event.color }}
                                            />
                                            <span className="text-xs text-gray-400">{formatTime(event.startTime)}</span>
                                        </div>
                                        <p className="text-white text-sm font-medium truncate">{event.title}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Event Detail Modal */}
            {selectedEvent && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg border border-gray-700">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <span
                                    className="px-2 py-1 rounded text-xs text-white inline-block mb-2"
                                    style={{ backgroundColor: selectedEvent.color }}
                                >
                                    {getEventTypeLabel(selectedEvent.type)}
                                </span>
                                <h2 className="text-xl font-bold text-white">{selectedEvent.title}</h2>
                            </div>
                            <button
                                onClick={() => setSelectedEvent(null)}
                                className="p-1 hover:bg-gray-700 rounded"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <p className="text-gray-400 mb-4">{selectedEvent.description}</p>

                        <div className="space-y-3 mb-6">
                            <div className="flex items-center gap-3 text-gray-300">
                                <Calendar className="w-5 h-5 text-blue-400" />
                                <span>{formatDate(selectedEvent.startTime)}</span>
                            </div>
                            <div className="flex items-center gap-3 text-gray-300">
                                <Clock className="w-5 h-5 text-blue-400" />
                                <span>{formatTime(selectedEvent.startTime)} - {formatTime(selectedEvent.endTime)}</span>
                            </div>
                            <div className="flex items-center gap-3 text-gray-300">
                                <MapPin className="w-5 h-5 text-blue-400" />
                                <span>{selectedEvent.location}</span>
                            </div>
                            {selectedEvent.meetingLink && (
                                <a
                                    href={selectedEvent.meetingLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 text-blue-400 hover:text-blue-300"
                                >
                                    <Video className="w-5 h-5" />
                                    <span>Join Meeting</span>
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            )}
                        </div>

                        <div className="mb-6">
                            <h4 className="text-sm font-medium text-gray-400 mb-2">Attendees</h4>
                            <div className="space-y-2">
                                {selectedEvent.attendees.map((attendee, index) => (
                                    <div key={index} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white text-sm">
                                                {attendee.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-white text-sm">{attendee.name}</p>
                                                <p className="text-gray-500 text-xs">{attendee.role}</p>
                                            </div>
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded ${attendee.status === 'ACCEPTED'
                                            ? 'bg-green-500/20 text-green-400'
                                            : attendee.status === 'DECLINED'
                                                ? 'bg-red-500/20 text-red-400'
                                                : 'bg-yellow-500/20 text-yellow-400'
                                            }`}>
                                            {attendee.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => handleDeleteEvent(selectedEvent.id)}
                                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                            <button
                                onClick={() => setSelectedEvent(null)}
                                className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Event Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg border border-gray-700">
                        <h3 className="text-xl font-semibold text-white mb-4">Create New Event</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Title *</label>
                                <input
                                    type="text"
                                    value={createForm.title}
                                    onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Event title"
                                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                                <select
                                    value={createForm.type}
                                    onChange={(e) => setCreateForm(prev => ({ ...prev, type: e.target.value }))}
                                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                >
                                    <option value="GENERAL">General</option>
                                    <option value="PITCH_SESSION">Pitch Session</option>
                                    <option value="DUE_DILIGENCE">Due Diligence</option>
                                    <option value="NEGOTIATION">Negotiation</option>
                                    <option value="CLOSING">Closing</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Start Time *</label>
                                    <input
                                        type="datetime-local"
                                        value={createForm.startTime}
                                        onChange={(e) => setCreateForm(prev => ({ ...prev, startTime: e.target.value }))}
                                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">End Time *</label>
                                    <input
                                        type="datetime-local"
                                        value={createForm.endTime}
                                        onChange={(e) => setCreateForm(prev => ({ ...prev, endTime: e.target.value }))}
                                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
                                <input
                                    type="text"
                                    value={createForm.location}
                                    onChange={(e) => setCreateForm(prev => ({ ...prev, location: e.target.value }))}
                                    placeholder="Virtual or physical location"
                                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Meeting Link</label>
                                <input
                                    type="url"
                                    value={createForm.meetingLink}
                                    onChange={(e) => setCreateForm(prev => ({ ...prev, meetingLink: e.target.value }))}
                                    placeholder="https://zoom.us/j/..."
                                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                                <textarea
                                    value={createForm.description}
                                    onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Event description"
                                    rows={3}
                                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateEvent}
                                className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                                Create Event
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}
