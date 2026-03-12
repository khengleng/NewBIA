
import React, { useState, useEffect } from 'react';
import { API_URL, authorizedRequest } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { FileSignature, CheckCircle, Clock, XCircle, Eye } from 'lucide-react';

interface Agreement {
    id: string;
    title: string;
    content: string;
    status: 'DRAFT' | 'PENDING_SIGNATURES' | 'COMPLETED' | 'CANCELLED';
    version: number;
    createdAt: string;
    userStatus: 'PENDING' | 'SIGNED' | 'REJECTED' | 'NOT_INVOLVED';
    canSign: boolean;
    signers: Signer[];
}

interface Signer {
    userId: string;
    status: 'PENDING' | 'SIGNED' | 'REJECTED';
    signedAt?: string;
    user: {
        firstName: string;
        lastName: string;
        email: string;
        role: string;
    };
}

interface Props {
    dealId: string;
    userRole?: string;
}

export default function AgreementSigning({ dealId, userRole }: Props) {
    const { addToast } = useToast();
    const [agreements, setAgreements] = useState<Agreement[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);
    const [showSignModal, setShowSignModal] = useState(false);
    const [signatureInput, setSignatureInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchAgreements = async () => {
        try {
            const response = await authorizedRequest(`/api/agreements/deal/${dealId}`);
            if (response.ok) {
                const data = await response.json();
                setAgreements(data);
            }
        } catch (error) {
            console.error('Error fetching agreements:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAgreements();
    }, [dealId]);

    const handleSign = async () => {
        if (!selectedAgreement || !signatureInput) return;

        setIsSubmitting(true);
        try {
            const response = await authorizedRequest(`/api/agreements/${selectedAgreement.id}/sign`, {
                method: 'POST',
                body: JSON.stringify({ signature: signatureInput })
            });

            if (response.ok) {
                addToast('success', 'Document signed successfully');
                setShowSignModal(false);
                setSignatureInput('');
                fetchAgreements();
            } else {
                const err = await response.json();
                addToast('error', err.error || 'Failed to sign document');
            }
        } catch (error) {
            console.error('Error signing document:', error);
            addToast('error', 'Failed to sign document');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="text-gray-400">Loading contracts...</div>;

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold text-white mb-4">Investment Agreements</h3>

            {agreements.length === 0 ? (
                <div className="text-center py-10 bg-gray-800 rounded-lg border border-gray-700 border-dashed">
                    <FileSignature className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400">No agreements generated for this deal yet.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {agreements.map((agreement) => (
                        <div key={agreement.id} className="bg-gray-800 p-5 rounded-lg border border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-gray-600 transition-colors">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold text-white text-lg">{agreement.title}</h4>
                                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${agreement.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                                        agreement.status === 'PENDING_SIGNATURES' ? 'bg-blue-500/20 text-blue-400' :
                                            'bg-gray-700 text-gray-400'
                                        }`}>
                                        {agreement.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-400 mb-2">Version {agreement.version} • Created {new Date(agreement.createdAt).toLocaleDateString()}</div>
                                <div className="flex -space-x-2 overflow-hidden">
                                    {agreement.signers.map((signer) => (
                                        <div key={signer.userId} className="relative group cursor-help">
                                            <div className={`w-8 h-8 rounded-full border-2 border-gray-800 flex items-center justify-center text-xs font-bold text-white ${signer.status === 'SIGNED' ? 'bg-green-600' : 'bg-gray-600'
                                                }`} title={`${signer.user.firstName} (${signer.status})`}>
                                                {signer.user.firstName[0]}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {agreement.canSign ? (
                                    <button
                                        onClick={() => {
                                            setSelectedAgreement(agreement);
                                            setShowSignModal(true);
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-blue-900/20 animate-pulse"
                                    >
                                        <FileSignature className="w-4 h-4" /> Sign Now
                                    </button>
                                ) : (
                                    <button
                                        className="text-gray-400 hover:text-white px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-700 flex items-center gap-2"
                                        onClick={() => {
                                            setSelectedAgreement(agreement);
                                            setShowSignModal(true); // Re-use modal for viewing for now
                                        }}
                                    >
                                        <Eye className="w-4 h-4" /> View
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Signing Modal */}
            {showSignModal && selectedAgreement && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-xl w-full max-w-2xl border border-gray-700 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">{selectedAgreement.title}</h3>
                            <button onClick={() => setShowSignModal(false)} className="text-gray-400 hover:text-white">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 text-gray-900 font-serif leading-relaxed text-sm">
                            {/* Render as plain text to avoid executing attacker-controlled markup. */}
                            {selectedAgreement.content ? (
                                <pre className="whitespace-pre-wrap break-words font-serif text-sm leading-relaxed">
                                    {selectedAgreement.content}
                                </pre>
                            ) : (
                                <p className="italic text-gray-500 text-center mt-10">Document content preview unavailable.</p>
                            )}
                        </div>

                        {selectedAgreement.canSign ? (
                            <div className="p-6 border-t border-gray-800 bg-gray-800 rounded-b-xl">
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    To sign this document, type your full legal name below.
                                </label>
                                <input
                                    type="text"
                                    value={signatureInput}
                                    onChange={(e) => setSignatureInput(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none mb-4"
                                    placeholder="e.g. John Doe"
                                />
                                <div className="text-xs text-gray-500 mb-4">
                                    By clicking "Sign Document", you agree to be legally bound by the terms of this agreement.
                                    Your IP address ({'127.0.0.1'}) and timestamp will be recorded.
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => setShowSignModal(false)}
                                        className="px-4 py-2 text-gray-300 hover:text-white"
                                        disabled={isSubmitting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSign}
                                        disabled={!signatureInput.trim() || isSubmitting}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isSubmitting ? 'Signing...' : <><FileSignature className="w-4 h-4" /> Sign Document</>}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 border-t border-gray-800 bg-gray-800 rounded-b-xl text-center">
                                <p className="text-gray-400 text-sm">
                                    {selectedAgreement.userStatus === 'SIGNED' ?
                                        `Signed by you on ${new Date().toLocaleDateString()}` :
                                        "You are not required to sign this document or signature is not pending."
                                    }
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
