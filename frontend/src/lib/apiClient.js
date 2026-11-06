/**
 * Standard API Client
 * Configured for session-based cookie authentication, automatic CSRF injection,
 * parameter serialization, and standardized envelope responses using native Fetch.
 */

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

let cachedCsrfToken = null;
let isFetchingCsrfToken = null;

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

  isFetchingCsrfToken = (async () => {
    try {
      const url = `${baseURL.replace(/\/+$/, '')}/auth/csrf-token`;
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        return null;
      }

      const json = await res.json();
      const token = json?.data?.csrf_token || json?.csrf_token;
      cachedCsrfToken = token;
      return token;
    } catch (err) {
      console.warn('Unable to retrieve CSRF token:', err.message);
      return null;
    } finally {
      isFetchingCsrfToken = null;
    }
  })();

  return isFetchingCsrfToken;
}

export function setCsrfToken(token) {
  cachedCsrfToken = token;
}

export function clearCsrfToken() {
  cachedCsrfToken = null;
}

/**
 * Core HTTP Request Runner
 */
async function request(method, path, data = null, options = {}) {
  const upperMethod = method.toUpperCase();
  const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  let url = path.startsWith('http')
    ? path
    : `${baseURL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

  // Query parameter serialization
  if (options.params && typeof options.params === 'object') {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(options.params)) {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const headers = {
    'Accept': 'application/json',
    ...(data !== null && !(data instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  // Inject CSRF token on mutating requests
  if (unsafeMethods.includes(upperMethod) && !headers['X-CSRF-Token']) {
    const token = await fetchCsrfToken();
    if (token) {
      headers['X-CSRF-Token'] = token;
    }
  }

  const fetchOptions = {
    method: upperMethod,
    headers,
    credentials: 'include',
    ...options,
  };

  if (data !== null) {
    fetchOptions.body = data instanceof FormData ? data : JSON.stringify(data);
  }

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (networkErr) {
    const err = new Error(networkErr.message || 'Network request failed');
    err.isNetworkError = true;
    throw err;
  }

  let responseData = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      responseData = await response.text();
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    const error = new Error(
      responseData?.error?.message ||
        responseData?.message ||
        `Request failed with status ${response.status}`
    );
    error.response = {
      status: response.status,
      statusText: response.statusText,
      data: responseData,
      headers: response.headers,
    };

    if (response.status === 401) {
      clearCsrfToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('toothcare:unauthorized', {
            detail: {
              code: responseData?.error?.code || 'UNAUTHENTICATED',
              message: responseData?.error?.message || 'Authentication is required.',
            },
          })
        );
      }
    } else if (response.status === 403) {
      if (responseData?.error?.code === 'CSRF_TOKEN_INVALID') {
        clearCsrfToken();
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('toothcare:forbidden', {
            detail: {
              code: responseData?.error?.code || 'FORBIDDEN',
              message: responseData?.error?.message || 'You do not have permission to perform this action.',
            },
          })
        );
      }
    }

    throw error;
  }

  return {
    data: responseData,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  };
}

export const apiClient = {
  get(path, options = {}) {
    return request('GET', path, null, options);
  },
  post(path, data = null, options = {}) {
    return request('POST', path, data, options);
  },
  put(path, data = null, options = {}) {
    return request('PUT', path, data, options);
  },
  patch(path, data = null, options = {}) {
    return request('PATCH', path, data, options);
  },
  delete(path, options = {}) {
    return request('DELETE', path, null, options);
  },
};

export default apiClient;
