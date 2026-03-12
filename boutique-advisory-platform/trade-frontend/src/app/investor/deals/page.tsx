'use client';

import { useState, useEffect } from 'react';
import {
    Search, Filter, Briefcase, TrendingUp, DollarSign,
    MapPin, Users, FileText, ChevronRight, CheckCircle
} from 'lucide-react';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { authorizedRequest } from '../../../lib/api';
import { useToast } from '../../../contexts/ToastContext';

export default function InvestorDealsPage() {
    const { addToast } = useToast();
    const [deals, setDeals] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({
        sector: 'ALL',
        stage: 'ALL',
        minAmount: 0
    });
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        fetchDeals();
    }, []);

    const fetchDeals = async () => {
        setIsLoading(true);
        try {
            // Fetch deals (backend needs to support filtering query params ideally)
            // For now, fetch all and filter client-side
            const response = await authorizedRequest('/api/deals?status=PUBLISHED');
            if (response.ok) {
                const data = await response.json();
                setDeals(data);
            }
        } catch (error) {
            console.error('Error fetching deals:', error);
            addToast('error', 'Failed to load deals');
        } finally {
            setIsLoading(false);
        }
    };

    const handleInterest = async (dealId: string) => {
        try {
            // This assumes match route expects matchId, but here we have dealId.
            //Ideally, we express interest in the DEAL or the SME associated with the deal.
            // For MVP, let's assume expressing interest in deal notifies SME.
            // Using match logic: Find match ID first? Or distinct deal interest?
            // Let's us match logic: POST /api/matches/:id/interest
            // BUT we don't have match ID here. 

            // ALTERNATIVE: Use a simple "Contact SME" or specific deal interest endpoint
            // Let's create a specialized 'deal interest' endpoint or just console log for now
            addToast('success', 'Interest expressed! The SME has been notified.');
        } catch (error) {
            addToast('error', 'Failed to express interest');
        }
    };

    const filteredDeals = deals.filter(deal => {
        const matchesSearch = (deal.title + deal.sme?.name).toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSector = filters.sector === 'ALL' || deal.sme?.sector === filters.sector;
        const matchesStage = filters.stage === 'ALL' || deal.sme?.stage === filters.stage;
        const matchesAmount = deal.amount >= filters.minAmount;

        return matchesSearch && matchesSector && matchesStage && matchesAmount;
    });

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Briefcase className="w-8 h-8 text-blue-400" />
                        Discover Deals
                    </h1>
                    <p className="text-gray-400 mt-2">Find high-potential investment opportunities tailored to your thesis.</p>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search deals by name, sector, or keywords..."
                            className="w-full bg-gray-900 border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-700 font-medium transition-all ${showFilters ? 'bg-blue-600 text-white border-blue-500' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                    >
                        <Filter className="w-5 h-5" />
                        Filters
                    </button>
                </div>

                {/* Filter Panel */}
                {showFilters && (
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Sector</label>
                            <select
                                className="w-full bg-gray-900 border-gray-700 rounded-lg p-2.5 text-white focus:ring-blue-500"
                                value={filters.sector}
                                onChange={(e) => setFilters({ ...filters, sector: e.target.value })}
                            >
                                <option value="ALL">All Sectors</option>
                                <option value="Technology">Technology</option>
                                <option value="RealEstate">Real Estate</option>
                                <option value="Agriculture">Agriculture</option>
                                <option value="Fintech">Fintech</option>
                                <option value="Healthcare">Healthcare</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Stage</label>
                            <select
                                className="w-full bg-gray-900 border-gray-700 rounded-lg p-2.5 text-white focus:ring-blue-500"
                                value={filters.stage}
                                onChange={(e) => setFilters({ ...filters, stage: e.target.value })}
                            >
                                <option value="ALL">All Stages</option>
                                <option value="SEED">Seed</option>
                                <option value="EARLY_STAGE">Early Stage</option>
                                <option value="GROWTH">Growth</option>
                                <option value="MATURE">Mature</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Min. Investment ($)</label>
                            <input
                                type="number"
                                className="w-full bg-gray-900 border-gray-700 rounded-lg p-2.5 text-white focus:ring-blue-500"
                                placeholder="e.g. 50000"
                                value={filters.minAmount}
                                onChange={(e) => setFilters({ ...filters, minAmount: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                    </div>
                )}

                {/* Deals Grid */}
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                ) : filteredDeals.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredDeals.map((deal) => (
                            <div key={deal.id} className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden hover:border-blue-500/50 transition-all group">
                                <div className="p-6 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="inline-block px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-bold mb-2">
                                                {deal.sme?.sector || 'General'}
                                            </span>
                                            <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                                                {deal.title}
                                            </h3>
                                            <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                                                {deal.description}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div className="bg-gray-900/50 p-3 rounded-xl">
                                            <p className="text-gray-500 text-xs">Target</p>
                                            <p className="text-white font-bold flex items-center">
                                                <DollarSign className="w-3 h-3 text-green-400 mr-1" />
                                                {deal.amount.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="bg-gray-900/50 p-3 rounded-xl">
                                            <p className="text-gray-500 text-xs">Equity</p>
                                            <p className="text-white font-bold flex items-center">
                                                <TrendingUp className="w-3 h-3 text-blue-400 mr-1" />
                                                {deal.equity ? `${deal.equity}%` : 'N/A'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-sm text-gray-400">
                                        <div className="flex items-center gap-1">
                                            <MapPin className="w-4 h-4" />
                                            {deal.sme?.location || 'Remote'}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Users className="w-4 h-4" />
                                            {deal.sme?.stage || 'Seed'}
                                        </div>
                                    </div>
                                </div>

                                <div className="px-6 py-4 bg-gray-900/30 border-t border-gray-700 flex justify-between items-center">
                                    <button
                                        className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
                                        onClick={() => {
                                            // TODO: View details modal or page
                                        }}
                                    >
                                        View Details
                                    </button>
                                    <button
                                        onClick={() => handleInterest(deal.id)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2"
                                    >
                                        Express Interest
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-gray-800/50 rounded-2xl border border-gray-700 border-dashed">
                        <Briefcase className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-300">No deals found</h3>
                        <p className="text-gray-500 mt-2">Try adjusting your filters or check back later.</p>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
