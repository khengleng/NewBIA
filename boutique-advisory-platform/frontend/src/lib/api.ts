// API Configuration
// In production, we use a proxy to hide the backend URL
export const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? '/api-proxy'
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003');

// CSRF Token Management
let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string | null> | null = null;

export function __resetApiTestState(): void {
    csrfToken = null;
    csrfTokenPromise = null;
}

async function ensureCsrfToken(): Promise<void> {
    if (csrfToken) return;
    if (csrfTokenPromise) {
        await csrfTokenPromise;
        return;
    }

    const fetchUrl = `${API_URL}/api/csrf-token?t=${Date.now()}`;
    console.log(`📡 Fetching CSRF token from: ${fetchUrl}`);


    csrfTokenPromise = fetch(fetchUrl, { credentials: 'include' })
        .then(async res => {
            const contentType = res.headers.get('content-type') || '';
            console.log(`📨 CSRF Response: ${res.status} (${contentType})`);

            if (!res.ok || !contentType.includes('application/json')) {
                const text = await res.text();
                const preview = text.substring(0, 100).replace(/\n/g, ' ');
                console.error(`❌ CSRF Fetch Failed (${res.status}): ${preview}`);
                throw new Error(`API Error ${res.status}: ${text.includes('Internal Server Error') ? 'Backend unreachable' : 'Invalid response'}`);
            }

            try {
                const data = await res.json();
                csrfToken = data.csrfToken;
                console.log('✅ CSRF token acquired');
                return csrfToken;
            } catch (parseError) {
                console.error('❌ Failed to parse CSRF JSON:', parseError);
                throw new Error('Invalid JSON received from CSRF endpoint');
            }
        })
        .catch(err => {
            console.error('⚠️ CSRF Token Error:', err.message);
            return null;
        });

    await csrfTokenPromise;
    csrfTokenPromise = null;
}


/**
 * Helper to safely parse JSON or throw a descriptive error if the response is HTML/Text
 */
async function handleResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
        const text = await response.text();
        // If it's a 500 error from proxy, it's usually HTML
        if (text.includes('Internal Server Error') || response.status >= 500) {
            throw new Error(`Server Error (${response.status}): The backend service is currently unavailable or returned an invalid response.`);
        }
        return { error: 'Invalid response format', details: text.substring(0, 100) };
    }
    return response.json();
}

// Helper function to make API calls
export async function apiRequest(
    endpoint: string,
    options: RequestInit = {}
): Promise<Response & { safeJson: () => Promise<any> }> {
    const url = `${API_URL}${endpoint}`;

    // Add default headers
    const headers = new Headers(options.headers);
    if (typeof window !== 'undefined') {
        headers.set('x-client-user-agent', window.navigator.userAgent || 'unknown');
        headers.set('x-client-platform', window.navigator.platform || 'unknown');
    }
    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
        headers.set('Content-Type', 'application/json');
    }

    // Add CSRF token for state-changing methods
    const method = options.method?.toUpperCase() || 'GET';
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        await ensureCsrfToken();
        if (csrfToken) {
            headers.set('x-csrf-token', csrfToken);
        }
    }

    let response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
    });

    // Handle occasional CSRF cookie/token desynchronization behind proxies by retrying once.
    if (response.status === 403 && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        const bodyPreview = (await response.clone().text()).toLowerCase();
        if (bodyPreview.includes('invalid csrf token')) {
            csrfToken = null;
            await ensureCsrfToken();

            if (csrfToken) {
                headers.set('x-csrf-token', csrfToken);
                response = await fetch(url, {
                    ...options,
                    headers,
                    credentials: 'include',
                });
            }
        }
    }

    // Attach a helper to the response object for easier safe parsing
    return Object.assign(response, {
        safeJson: () => handleResponse(response)
    });
}


// Authorized API request (Legacy wrapper, now just calls apiRequest as cookies are sent automatically)
export async function authorizedRequest(
    endpoint: string,
    options: RequestInit = {}
): Promise<Response> {
    return apiRequest(endpoint, options);
}
