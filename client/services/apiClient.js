import { fetchAuthSession } from 'aws-amplify/auth';

/**
 * Global Fetch Wrapper
 * Automatically attaches Cognito ID Token to every request
 */
export const authFetch = async (url, options = {}) => {
    try {

        // 1. Get the latest session from Cognito (Amplify handles refreshing)
        const session = await fetchAuthSession();
        const token = session.tokens.idToken?.toString();
        const headers = { ...options.headers };
        const authHeaders = {
            ...options.headers,
            'Authorization': token ? `Bearer ${token}` : ''
        };

        // 🚨 Only add JSON Content-Type if the body is NOT FormData
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        // 2. Merge existing headers with the Authorization header

        // 3. Execute the real fetch
        const response = await fetch(url, {
            ...options,
            headers: authHeaders,
        });

        // 4. Handle Unauthorized (Optional: redirect to login)
        if (response.status === 401) {
            window.location.href = '/signin';
        }

        return response;
    } catch (error) {
        console.error('AuthFetch Error:', error);
        // Fallback to normal fetch if session fails
        return fetch(url, options);
    }
};