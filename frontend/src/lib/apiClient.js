import axios from 'axios';

/**
 * Standard Axios API Client
 * Configured for session-based cookie authentication, automatic CSRF injection, and standardized envelope responses.
 */

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

let cachedCsrfToken = null;
let isFetchingCsrfToken = null;

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 15000,
});

/**
 * Fetch and cache the active CSRF token from the backend
 */
export async function fetchCsrfToken() {
  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }

  if (isFetchingCsrfToken) {
    return isFetchingCsrfToken;
  }

  isFetchingCsrfToken = apiClient
    .get('/auth/csrf-token')
    .then((res) => {
      const token = res.data?.data?.csrf_token || res.data?.csrf_token;
      cachedCsrfToken = token;
      return token;
    })
    .catch((err) => {
      console.warn('Unable to retrieve CSRF token:', err.message);
      return null;
    })
    .finally(() => {
      isFetchingCsrfToken = null;
    });

  return isFetchingCsrfToken;
}

export function setCsrfToken(token) {
  cachedCsrfToken = token;
}

export function clearCsrfToken() {
  cachedCsrfToken = null;
}

// Request interceptor: inject CSRF token on unsafe HTTP methods
apiClient.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toUpperCase();
  const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  if (unsafeMethods.includes(method) && !config.headers['X-CSRF-Token']) {
    const token = await fetchCsrfToken();
    if (token) {
      config.headers['X-CSRF-Token'] = token;
    }
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor: handle session expiration (401) and security rejections (403)
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      clearCsrfToken();
      window.dispatchEvent(new CustomEvent('toothcare:unauthorized', {
        detail: {
          code: error.response?.data?.error?.code || 'UNAUTHENTICATED',
          message: error.response?.data?.error?.message || 'Authentication is required.',
        },
      }));
    } else if (status === 403 && error.response?.data?.error?.code === 'CSRF_TOKEN_INVALID') {
      clearCsrfToken();
    }

    return Promise.reject(error);
  }
);

export default apiClient;

