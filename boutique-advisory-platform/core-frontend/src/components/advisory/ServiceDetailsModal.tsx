import { X, Calendar, Star, User, Clock, Tag } from 'lucide-react'

interface ServiceDetailsModalProps {
    service: any
    onClose: () => void
    onBook: () => void
}

export default function ServiceDetailsModal({ service, onClose, onBook }: ServiceDetailsModalProps) {
    if (!service) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-700 animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-700 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">{service.name}</h2>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                                {service.category}
                            </span>
                            {service.rating && (
                                <div className="flex items-center text-yellow-400 text-sm">
                                    <Star className="w-4 h-4 fill-current mr-1" />
                                    {service.rating}
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="prose prose-invert max-w-none">
                        <p className="text-gray-300 text-lg leading-relaxed">{service.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-700/50 p-4 rounded-lg">
                            <h3 className="text-gray-400 text-sm font-medium mb-1 flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Duration
                            </h3>
                            <p className="text-white font-medium">{service.duration || 'Flexible'}</p>
                        </div>
                        <div className="bg-gray-700/50 p-4 rounded-lg">
                            <h3 className="text-gray-400 text-sm font-medium mb-1 flex items-center gap-2">
                                <Tag className="w-4 h-4" /> Price
                            </h3>
                            <p className="text-white font-medium text-lg text-green-400">
                                {typeof service.price === 'number'
                                    ? `$${service.price.toLocaleString()}`
                                    : service.price}
                            </p>
                        </div>
                        {service.advisor && (
                            <div className="bg-gray-700/50 p-4 rounded-lg col-span-2">
                                <h3 className="text-gray-400 text-sm font-medium mb-1 flex items-center gap-2">
                                    <User className="w-4 h-4" /> Advisor
                                </h3>
                                <p className="text-white font-medium">
                                    {typeof service.advisor === 'object' ? service.advisor.name : service.advisor}
                                </p>
                            </div>
                        )}
                    </div>

                    {service.features && service.features.length > 0 && (
                        <div>
                            <h3 className="text-white font-semibold mb-3">What's Included</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {service.features.map((feature: string, idx: number) => (
                                    <div key={idx} className="flex items-start gap-2 text-gray-300 text-sm">
                                        <div className="min-w-1.5 h-1.5 rounded-full bg-blue-500 mt-2"></div>
                                        {feature}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-700 bg-gray-800/50 rounded-b-xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={onBook}
                        className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-bold shadow-lg shadow-blue-900/20 flex items-center gap-2 transition-all"
                    >
                        <Calendar className="w-4 h-4" />
                        Book Now
                    </button>
                </div>
            </div>
        </div>
    )
}
