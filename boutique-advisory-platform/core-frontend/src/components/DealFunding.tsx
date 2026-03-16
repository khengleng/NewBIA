
import React, { useState, useEffect } from 'react';
import { API_URL, authorizedRequest } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { ShieldCheck, DollarSign, ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react';

interface Props {
    dealId: string;
    userRole?: string;
}

interface EscrowAccount {
    id: string;
    balance: number;
    currency: string;
    status: string;
}

interface Transaction {
    id: string;
    type: 'DEPOSIT' | 'RELEASE' | 'REFUND';
    amount: number;
    currency: string;
    status: 'PENDING' | 'COMPLETED';
    description: string;
    createdAt: string;
}

export default function DealFunding({ dealId, userRole }: Props) {
    const { addToast } = useToast();
    const [escrow, setEscrow] = useState<EscrowAccount | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [depositAmount, setDepositAmount] = useState('');

    const isInvestor = userRole === 'INVESTOR';
    const canApprove = ['ADMIN', 'ADVISOR', 'SUPER_ADMIN'].includes(userRole || '');

    const fetchEscrow = async () => {
        try {
            const response = await authorizedRequest(`/api/escrow/${dealId}`);
            if (response.ok) {
                const data = await response.json();
                setEscrow(data.escrow);
                setTransactions(data.transactions);
            }
        } catch (error) {
            console.error('Error fetching escrow:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEscrow();
    }, [dealId]);

    const handleDeposit = async () => {
        if (!depositAmount || parseFloat(depositAmount) <= 0) return;

        try {
            const response = await authorizedRequest(`/api/escrow/${dealId}/deposit`, {
                method: 'POST',
                body: JSON.stringify({
                    amount: parseFloat(depositAmount),
                    currency: 'USD',
                    type: 'DEPOSIT',
                    description: 'Investor Deposit'
                })
            });

            if (response.ok) {
                addToast('success', 'Deposit successful');
                setShowDepositModal(false);
                setDepositAmount('');
                fetchEscrow();
            } else {
                addToast('error', 'Deposit failed');
            }
        } catch (error) {
            console.error('Error depositing:', error);
            addToast('error', 'Deposit failed');
        }
    };

    const handleReleaseRequest = async () => {
        // Implement release logic (omitted for brevity in this step if not explicitly asked, but structure is here)
        if (!confirm('Request release of funds to SME?')) return;

        try {
            const response = await authorizedRequest(`/api/escrow/${dealId}/release`, {
                method: 'POST',
                body: JSON.stringify({
                    amount: escrow?.balance || 0,
                    currency: 'USD',
                    type: 'RELEASE',
                    description: 'Final Release to SME'
                })
            });

            if (response.ok) {
                addToast('success', 'Release requested');
                fetchEscrow();
            }
        } catch (error) {
            console.error('Error requesting release', error);
        }
    };

    const handleApprove = async (txId: string) => {
        try {
            const response = await authorizedRequest(`/api/escrow/approve/${txId}`, {
                method: 'POST'
            });

            if (response.ok) {
                addToast('success', 'Transaction Approved');
                fetchEscrow();
            }
        } catch (error) {
            console.error('Error approving', error);
        }
    }

    if (loading) return <div className="text-gray-400">Loading funding data...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-gray-800 p-6 rounded-xl border border-gray-700">
                <div>
                    <h3 className="text-lg font-medium text-gray-400 mb-1">Escrow Balance</h3>
                    <div className="text-4xl font-bold text-white flex items-center gap-2">
                        <DollarSign className="w-8 h-8 text-green-400" />
                        {escrow?.balance.toLocaleString()}
                        <span className="text-lg text-gray-500 font-normal">{escrow?.currency}</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    {isInvestor && (
                        <button
                            onClick={() => setShowDepositModal(true)}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-green-900/20"
                        >
                            <ArrowDownLeft className="w-5 h-5" /> Deposit Funds
                        </button>
                    )}

                    {canApprove && escrow && escrow.balance > 0 && (
                        <button
                            onClick={handleReleaseRequest}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
                        >
                            Request Release
                        </button>
                    )}
                </div>
            </div>

            {/* Transactions */}
            <h4 className="text-lg font-semibold text-white mt-8 mb-4">Transaction History</h4>
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                {transactions.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No transactions yet.</div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-900/50 text-gray-400 text-sm">
                            <tr>
                                <th className="p-4">Type</th>
                                <th className="p-4">Amount</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Date</th>
                                <th className="p-4">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700 text-sm">
                            {transactions.map(tx => (
                                <tr key={tx.id} className="hover:bg-gray-700/30 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            {tx.type === 'DEPOSIT' && <ArrowDownLeft className="w-4 h-4 text-green-400" />}
                                            {tx.type === 'RELEASE' && <ArrowUpRight className="w-4 h-4 text-red-400" />}
                                            <span className="text-white font-medium">{tx.type}</span>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">{tx.description}</div>
                                    </td>
                                    <td className={`p-4 font-mono font-medium ${tx.type === 'DEPOSIT' ? 'text-green-400' : 'text-white'}`}>
                                        {tx.type === 'DEPOSIT' ? '+' : '-'}${tx.amount.toLocaleString()}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs ${tx.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                                            }`}>
                                            {tx.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-400">
                                        {new Date(tx.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="p-4">
                                        {tx.status === 'PENDING' && canApprove && tx.type === 'RELEASE' && (
                                            <button
                                                onClick={() => handleApprove(tx.id)}
                                                className="text-blue-400 hover:text-blue-300 text-xs underline"
                                            >
                                                Approve
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Deposit Modal */}
            {showDepositModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-6 rounded-xl w-full max-w-md border border-gray-700">
                        <h3 className="text-xl font-bold text-white mb-4">Deposit Funds</h3>
                        <p className="text-gray-400 text-sm mb-6">Funds will be held securely in escrow until deal conditions are met.</p>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-300 mb-2">Amount (USD)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                <input
                                    type="number"
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-8 pr-4 py-3 text-white text-lg font-mono placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:outline-none"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDepositModal(false)}
                                className="flex-1 px-4 py-3 text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeposit}
                                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-lg shadow-green-900/20"
                            >
                                Confirm Deposit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
