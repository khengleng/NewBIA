
import React, { useState, useEffect } from 'react';
import { CheckCircle, Circle, AlertCircle, Plus, Trash2, ArrowRight } from 'lucide-react';
import { API_URL, authorizedRequest } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

interface DueDiligenceItem {
    id: string;
    task: string;
    description?: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'WAIVED';
    assignedTo?: string;
    completedAt?: string;
    completedBy?: string;
}

interface Props {
    dealId: string;
    userRole?: string;
}

export default function DueDiligenceChecklist({ dealId, userRole }: Props) {
    const { addToast } = useToast();
    const [items, setItems] = useState<DueDiligenceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newItem, setNewItem] = useState({ task: '', description: '' });

    const canEdit = ['ADMIN', 'ADVISOR', 'SME', 'SUPER_ADMIN'].includes(userRole || '');
    const canManage = ['ADMIN', 'ADVISOR', 'SUPER_ADMIN'].includes(userRole || '');

    const fetchItems = async () => {
        try {
            const response = await authorizedRequest(`/api/deal-due-diligence/${dealId}`);
            if (response.ok) {
                const data = await response.json();
                setItems(data.items);
                setProgress(data.progress);
            }
        } catch (error) {
            console.error('Error fetching due diligence:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [dealId]);

    const handleStatusChange = async (itemId: string, newStatus: string) => {
        if (!canEdit) return;

        try {
            const response = await authorizedRequest(`/api/deal-due-diligence/${dealId}/items/${itemId}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                fetchItems(); // Refresh to update progress
                addToast('success', 'Status updated');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            addToast('error', 'Failed to update status');
        }
    };

    const handleAddItem = async () => {
        if (!newItem.task) return;

        try {
            const response = await authorizedRequest(`/api/deal-due-diligence/${dealId}/items`, {
                method: 'POST',
                body: JSON.stringify({
                    task: newItem.task,
                    description: newItem.description,
                    order: items.length + 1
                })
            });

            if (response.ok) {
                setNewItem({ task: '', description: '' });
                setShowAddModal(false);
                fetchItems();
                addToast('success', 'Item added');
            }
        } catch (error) {
            console.error('Error adding item:', error);
            addToast('error', 'Failed to add item');
        }
    };

    const handleCompleteDueDiligence = async () => {
        if (!confirm('Are you sure all due diligence is complete? This will move the deal to NEGOTIATION stage.')) return;

        try {
            const response = await authorizedRequest(`/api/deal-due-diligence/${dealId}/complete`, {
                method: 'POST'
            });

            if (response.ok) {
                addToast('success', 'Due Diligence Completed! Deal moved to Negotiation.');
                window.location.reload(); // Refresh to show new deal status
            } else {
                const err = await response.json();
                addToast('error', err.error || 'Failed to complete due diligence');
            }
        } catch (error) {
            console.error('Error completing due diligence:', error);
        }
    };

    if (loading) return <div className="text-gray-400">Loading checklist...</div>;

    // Define color for status
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': return 'text-green-400';
            case 'WAIVED': return 'text-gray-500';
            case 'IN_PROGRESS': return 'text-blue-400';
            default: return 'text-gray-600';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-white">Due Diligence Checklist</h3>
                {canManage && (
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Add Item
                    </button>
                )}
            </div>

            {/* Progress Bar */}
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Progress</span>
                    <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>
            </div>

            {/* Checklist Items */}
            <div className="space-y-3">
                {items.length === 0 && (
                    <div className="text-center py-8 text-gray-500 bg-gray-800 rounded-lg border border-gray-700 border-dashed">
                        <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p>No checklist items yet.</p>
                        {canManage && <p className="text-sm">Add tasks to track the due diligence process.</p>}
                    </div>
                )}

                {items.map((item) => (
                    <div key={item.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex items-start gap-4">
                        <button
                            disabled={!canEdit}
                            onClick={() => {
                                const nextStatus = item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
                                handleStatusChange(item.id, nextStatus);
                            }}
                            className={`mt-1 flex-shrink-0 ${getStatusColor(item.status)}`}
                        >
                            {item.status === 'COMPLETED' ? <CheckCircle className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                        </button>

                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                                <h4 className={`font-medium ${item.status === 'COMPLETED' ? 'text-gray-500 line-through' : 'text-white'}`}>
                                    {item.task}
                                </h4>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 text-xs rounded border ${item.status === 'COMPLETED' ? 'border-green-500/30 bg-green-500/10 text-green-400' :
                                        item.status === 'IN_PROGRESS' ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' :
                                            'border-gray-600 bg-gray-700 text-gray-400'
                                        }`}>
                                        {item.status.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                            {item.description && <p className="text-gray-400 text-sm mt-1">{item.description}</p>}

                            {/* Simple Status Actions */}
                            {canEdit && item.status !== 'COMPLETED' && (
                                <div className="mt-3 flex gap-2">
                                    {item.status === 'PENDING' && (
                                        <button
                                            onClick={() => handleStatusChange(item.id, 'IN_PROGRESS')}
                                            className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 bg-blue-500/10 rounded"
                                        >
                                            Mark In Progress
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleStatusChange(item.id, 'WAIVED')}
                                        className="text-xs text-gray-400 hover:text-gray-300 px-2 py-1 bg-gray-700 rounded"
                                    >
                                        Waive
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Completion Action */}
            {items.length > 0 && progress === 100 && canManage && (
                <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg flex justify-between items-center animate-in fade-in zoom-in duration-300">
                    <div>
                        <h4 className="font-semibold text-green-400">Due Diligence Complete</h4>
                        <p className="text-sm text-green-300/80">All items have been verified. You can now proceed to negotiation.</p>
                    </div>
                    <button
                        onClick={handleCompleteDueDiligence}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-green-900/20"
                    >
                        Proceed to Negotiation <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Add Item Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 p-6 rounded-xl w-full max-w-md border border-gray-700">
                        <h3 className="text-xl font-bold text-white mb-4">Add Checklist Item</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Task</label>
                                <input
                                    type="text"
                                    value={newItem.task}
                                    onChange={(e) => setNewItem({ ...newItem, task: e.target.value })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                                    placeholder="e.g., Verify Bank Statements"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Description (Optional)</label>
                                <textarea
                                    value={newItem.description}
                                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white h-24"
                                    placeholder="Additional details..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 text-gray-300 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddItem}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Add Item
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
