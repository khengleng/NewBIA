'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { API_URL, authorizedRequest } from '@/lib/api'
import {
    ChevronLeft,
    Calendar,
    Star,
    Clock,
    Briefcase,
    GraduationCap,
    Award,
    CheckCircle,
    MessageSquare
} from 'lucide-react'
import StripePaymentModal from '@/components/advisory/StripePaymentModal'

export default function AdvisorProfilePage() {
    const params = useParams()
    const router = useRouter()
    const [advisor, setAdvisor] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null)
    const [paymentAmount, setPaymentAmount] = useState<number>(0)
    const [pendingBookingData, setPendingBookingData] = useState<any>(null)
    const [abaQrData, setAbaQrData] = useState<{ qrString: string; qrImage: string } | null>(null)
    const [paymentId, setPaymentId] = useState<string | null>(null)

    // Polling for ABA Payment Status
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (abaQrData && paymentId) {
            interval = setInterval(async () => {
                try {
                    const res = await authorizedRequest(`/api/payments/aba/status/${paymentId}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.status === 'COMPLETED') {
                            clearInterval(interval);
                            handleBookingSuccess();
                        }
                    }
                } catch (e) {
                    console.error('Polling error', e);
                }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [abaQrData, paymentId]);

    useEffect(() => {
        const fetchAdvisor = async () => {
            try {
                const res = await authorizedRequest(`/api/advisory/advisors/${params.id}`)

                if (res.ok) {
                    const data = await res.json()
                    setAdvisor(data)
                } else {
                    console.error('Failed to fetch advisor')
                    // router.push('/advisory') // Optional redirect on error
                }
            } catch (error) {
                console.error('Error fetching advisor:', error)
            } finally {
                setIsLoading(false)
            }
        }

        if (params.id) fetchAdvisor()
    }, [params.id, router])

    const handleBookSession = async (service?: any) => {
        try {
            // Determine amount and type
            let amount = 0
            let notes = ''
            let serviceId = null

            if (service) {
                // Booking specific service
                amount = typeof service.price === 'string'
                    ? parseFloat(service.price.replace(/[^0-9.]/g, '')) || 0
                    : service.price || 0;
                notes = `Booking service: ${service.name}`
                serviceId = service.id
            } else if (advisor) {
                // Booking general session (hourly)
                amount = 250 // Default hourly rate if missing
                if (advisor.hourlyRate) {
                    amount = typeof advisor.hourlyRate === 'string'
                        ? parseFloat(advisor.hourlyRate.replace(/[^0-9.]/g, '')) || 250
                        : advisor.hourlyRate;
                }
                notes = `Booking consultation session with ${advisor.name}`
            }

            // Create Payment Intent
            const paymentRes = await authorizedRequest('/api/payments/create-payment-intent', {
                method: 'POST',
                body: JSON.stringify({
                    amount,
                    advisorId: advisor.id,
                    serviceId // Optional
                })
            })

            if (paymentRes.ok) {
                const { clientSecret } = await paymentRes.json()
                setPaymentClientSecret(clientSecret)
                setPaymentAmount(amount)
                setPendingBookingData({
                    advisorId: advisor.id,
                    advisorName: advisor.name,
                    serviceId: serviceId,
                    serviceName: service?.name || 'Consultation Session',
                    preferredDate: new Date().toISOString().split('T')[0],
                    notes
                })
                setShowPaymentModal(true)
            }
        } catch (error) {
            console.error('Error creating booking:', error)
        }
    }

    const handleBookingSuccess = async () => {
        try {
            const response = await authorizedRequest('/api/advisory/book', {
                method: 'POST',
                body: JSON.stringify({
                    ...pendingBookingData,
                    amount: paymentAmount
                })
            })

            if (response.ok) {
                alert('Booking Confirmed Successfully!')
                setShowPaymentModal(false)
                setPaymentClientSecret(null)
            }
        } catch (error) {
            console.error('Error confirming booking:', error)
        }
    }

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        )
    }

    if (!advisor) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white">
                <h2 className="text-2xl font-bold mb-4">Advisor Not Found</h2>
                <Link href="/advisory" className="text-blue-400 hover:text-blue-300">
                    Back to Advisory
                </Link>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-6xl mx-auto">
                <Link href="/advisory" className="inline-flex items-center text-gray-400 hover:text-white mb-8">
                    <ChevronLeft className="w-5 h-5 mr-1" />
                    Back to Advisory Services
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Profile Card */}
                    <div className="lg:col-span-1">
                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 sticky top-8">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-32 h-32 rounded-full overflow-hidden mb-4 border-4 border-gray-700">
                                    <img
                                        src={advisor.image || `https://ui-avatars.com/api/?name=${advisor.name}&background=random`}
                                        alt={advisor.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <h1 className="text-2xl font-bold mb-1">{advisor.name}</h1>
                                <p className="text-blue-400 font-medium mb-4">{advisor.role}</p>

                                <div className="flex items-center justify-center gap-1 mb-6">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                            key={i}
                                            className={`w-5 h-5 ${i < Math.floor(advisor.rating || 0)
                                                ? 'text-yellow-400 fill-current'
                                                : 'text-gray-600'
                                                }`}
                                        />
                                    ))}
                                    <span className="ml-2 text-gray-400">({advisor.reviews || 0} reviews)</span>
                                </div>

                                <div className="w-full space-y-4 mb-6">
                                    <div className="flex justify-between items-center px-4 py-3 bg-gray-700/50 rounded-lg">
                                        <div className="flex items-center text-gray-300">
                                            <Clock className="w-4 h-4 mr-2" />
                                            <span>Hourly Rate</span>
                                        </div>
                                        <span className="font-semibold text-white">{advisor.hourlyRate || '$250'}/hr</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleBookSession()}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center"
                                >
                                    <Calendar className="w-5 h-5 mr-2" />
                                    Book General Consultation
                                </button>

                                <button className="w-full mt-3 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center">
                                    <MessageSquare className="w-5 h-5 mr-2" />
                                    Message Advisor
                                </button>
                            </div>

                            <div className="mt-8 pt-6 border-t border-gray-700">
                                <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Expertise</h3>
                                <div className="flex flex-wrap gap-2">
                                    {advisor.specialization?.map((spec: string, idx: number) => (
                                        <span key={idx} className="px-3 py-1 bg-blue-900/30 text-blue-300 text-xs rounded-full border border-blue-800">
                                            {spec}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Details & Services */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Bio Section */}
                        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
                            <h2 className="text-xl font-bold mb-4 flex items-center">
                                <Briefcase className="w-6 h-6 mr-3 text-blue-500" />
                                About {advisor.name}
                            </h2>
                            <div className="text-gray-300 leading-relaxed space-y-4">
                                <p>{advisor.bio || 'No biography available.'}</p>
                            </div>

                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {advisor.education && (
                                    <div className="flex items-start">
                                        <GraduationCap className="w-5 h-5 mt-1 mr-3 text-gray-400" />
                                        <div>
                                            <h4 className="text-white font-medium">Education</h4>
                                            <p className="text-gray-400 text-sm">{advisor.education}</p>
                                        </div>
                                    </div>
                                )}
                                {advisor.completedProjects && (
                                    <div className="flex items-start">
                                        <CheckCircle className="w-5 h-5 mt-1 mr-3 text-gray-400" />
                                        <div>
                                            <h4 className="text-white font-medium">Track Record</h4>
                                            <p className="text-gray-400 text-sm">{advisor.completedProjects} Projects Completed</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Services Section */}
                        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
                            <h2 className="text-xl font-bold mb-6 flex items-center">
                                <Award className="w-6 h-6 mr-3 text-purple-500" />
                                Available Services
                            </h2>

                            {advisor.services && advisor.services.length > 0 ? (
                                <div className="grid gap-4">
                                    {advisor.services.map((service: any) => (
                                        <div key={service.id} className="bg-gray-700/50 rounded-lg p-6 hover:bg-gray-700 transition-colors border border-gray-600/50">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="text-lg font-semibold text-white mb-2">{service.name}</h3>
                                                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">{service.description}</p>
                                                    <div className="flex items-center gap-4 text-sm text-gray-300">
                                                        <span className="flex items-center"><Clock className="w-4 h-4 mr-1" /> {service.duration}</span>
                                                        <span className="px-2 py-0.5 bg-gray-600 rounded text-xs">{service.category}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xl font-bold text-white mb-3">
                                                        {typeof service.price === 'number' ? `$${service.price}` : service.price}
                                                    </div>
                                                    <button
                                                        onClick={() => handleBookSession(service)}
                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                                                    >
                                                        Book Service
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-400 italic">No specific services listed. Please book a general consultation.</p>
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {showPaymentModal && pendingBookingData && paymentClientSecret && (
                <StripePaymentModal
                    amount={paymentAmount}
                    clientSecret={paymentClientSecret}
                    onSuccess={handleBookingSuccess}
                    abaQrData={abaQrData}
                    onAbaPay={async () => {
                        try {
                            const res = await authorizedRequest('/api/payments/aba/generate-qr', {
                                method: 'POST',
                                body: JSON.stringify({
                                    amount: paymentAmount,
                                    items: [{ name: pendingBookingData.serviceName, price: paymentAmount, quantity: 1 }],
                                })
                            });

                            if (res.ok) {
                                const data = await res.json();
                                if (data.qrString || data.qrImage) {
                                    setAbaQrData({ qrString: data.qrString, qrImage: data.qrImage });
                                    setPaymentId(data.paymentId);
                                } else {
                                    alert('Failed to generate Direct QR');
                                }
                            } else {
                                alert('Failed to initiate ABA QR Payment');
                            }
                        } catch (e) {
                            console.error(e);
                            alert('Error initiating ABA Payment');
                        }
                    }}
                    onCancel={() => {
                        setShowPaymentModal(false)
                        setAbaQrData(null)
                        setPaymentId(null)
                    }}
                />
            )}
        </div>
    )
}
