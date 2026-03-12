// API Service for interacting with the backend
// This replaces all localStorage calls with database-backed API calls

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

// Helper function to get auth token (Legacy - token is now in HttpOnly cookie)
const getAuthToken = (): string | null => {
    return null;
};

// Helper function to get auth headers (now just for content-type)
const getAuthHeaders = (): HeadersInit => {
    return {
        'Content-Type': 'application/json',
    };
};

// Generic API request handler
async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${API_URL}${endpoint}`;
    const config: RequestInit = {
        ...options,
        credentials: 'include', // SECURITY: Send HttpOnly cookies
        headers: {
            ...getAuthHeaders(),
            ...options.headers,
        },
    };

    try {
        const response = await fetch(url, config);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

// ==================== AUTH API ====================

export const authAPI = {
    async login(email: string, password: string) {
        const response = await apiRequest<{
            token: string;
            user: {
                id: string;
                email: string;
                role: string;
                firstName: string;
                lastName: string;
            };
        }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        // Store user in localStorage (for UI profile), token is handled via HttpOnly cookie
        if (typeof window !== 'undefined') {
            localStorage.setItem('user', JSON.stringify(response.user));
        }

        return response;
    },

    async register(data: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        role: string;
    }) {
        const response = await apiRequest<{
            token: string;
            user: {
                id: string;
                email: string;
                role: string;
                firstName: string;
                lastName: string;
            };
        }>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
        });

        // Store user in localStorage (for UI profile), token is handled via HttpOnly cookie
        if (typeof window !== 'undefined') {
            localStorage.setItem('user', JSON.stringify(response.user));
        }

        return response;
    },

    async forgotPassword(email: string) {
        return await apiRequest('/api/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    },

    async resetPassword(token: string, password: string) {
        return await apiRequest('/api/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, password }),
        });
    },

    async getCurrentUser() {
        return await apiRequest<{
            user: {
                id: string;
                email: string;
                role: string;
                firstName: string;
                lastName: string;
            };
        }>('/api/auth/me');
    },

    async logout() {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('user');
        }
        // Call backend logout to revoke refresh token and clear cookies
        await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => { });
    },
};

// ==================== SME API ====================

export const smeAPI = {
    async getAll() {
        return await apiRequest<{ smes: any[] }>('/api/smes');
    },

    async getById(id: string) {
        return await apiRequest<{ sme: any }>(`/api/smes/${id}`);
    },

    async create(data: any) {
        return await apiRequest<{ sme: any }>('/api/smes', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async update(id: string, data: any) {
        return await apiRequest<{ sme: any }>(`/api/smes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    async delete(id: string) {
        return await apiRequest(`/api/smes/${id}`, {
            method: 'DELETE',
        });
    },
};

// ==================== INVESTOR API ====================

export const investorAPI = {
    async getAll() {
        return await apiRequest<{ investors: any[] }>('/api/investors');
    },

    async getById(id: string) {
        return await apiRequest<{ investor: any }>(`/api/investors/${id}`);
    },

    async create(data: any) {
        return await apiRequest<{ investor: any }>('/api/investors', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async update(id: string, data: any) {
        return await apiRequest<{ investor: any }>(`/api/investors/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    async delete(id: string) {
        return await apiRequest(`/api/investors/${id}`, {
            method: 'DELETE',
        });
    },
};

// ==================== DEAL API ====================

export const dealAPI = {
    async getAll() {
        return await apiRequest<{ deals: any[] }>('/api/deals');
    },

    async getById(id: string) {
        return await apiRequest<{ deal: any }>(`/api/deals/${id}`);
    },

    async create(data: any) {
        return await apiRequest<{ deal: any }>('/api/deals', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async update(id: string, data: any) {
        return await apiRequest<{ deal: any }>(`/api/deals/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    async delete(id: string) {
        return await apiRequest(`/api/deals/${id}`, {
            method: 'DELETE',
        });
    },
};

// ==================== DOCUMENT API ====================

export const documentAPI = {
    async upload(file: File, dealId?: string) {
        const formData = new FormData();
        formData.append('file', file);
        if (dealId) formData.append('dealId', dealId);

        const response = await fetch(`${API_URL}/api/documents/upload`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
        });

        if (!response.ok) {
            throw new Error('Document upload failed');
        }

        return await response.json();
    },

    async getByDeal(dealId: string) {
        return await apiRequest<{ documents: any[] }>(`/api/documents/deal/${dealId}`);
    },

    async delete(id: string) {
        return await apiRequest(`/api/documents/${id}`, {
            method: 'DELETE',
        });
    },
};

// Export a centralized API object
export const api = {
    auth: authAPI,
    sme: smeAPI,
    investor: investorAPI,
    deal: dealAPI,
    document: documentAPI,
};

export default api;
