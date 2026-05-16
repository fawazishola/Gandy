/**
 * API Client for Gandy Backend
 * Centralized HTTP client with automatic retry, error handling, and caching
 */

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Create axios instance with default configuration
 */
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor - add auth token, logging, etc.
 */
apiClient.interceptors.request.use(
  (config) => {
    // Add timestamp for request tracking
    config.metadata = { startTime: Date.now() };
    
    // Add auth token if available (future)
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log request in development
    if (import.meta.env.DEV) {
      console.log(`[API] ${config.method.toUpperCase()} ${config.url}`, config.data);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - handle errors, logging, etc.
 */
apiClient.interceptors.response.use(
  (response) => {
    // Calculate request duration
    const duration = Date.now() - response.config.metadata.startTime;
    
    // Log response in development
    if (import.meta.env.DEV) {
      console.log(
        `[API] ${response.config.method.toUpperCase()} ${response.config.url} - ${response.status} (${duration}ms)`,
        response.data
      );
    }
    
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Handle network errors
    if (!error.response) {
      console.error('[API] Network error:', error.message);
      return Promise.reject({
        message: 'Network error. Please check your connection.',
        type: 'network_error',
        originalError: error
      });
    }
    
    // Handle 401 Unauthorized - refresh token (future)
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      // TODO: Implement token refresh logic
      // const newToken = await refreshAuthToken();
      // originalRequest.headers.Authorization = `Bearer ${newToken}`;
      // return apiClient(originalRequest);
    }
    
    // Handle 429 Too Many Requests - retry with backoff
    if (error.response.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 5;
      console.warn(`[API] Rate limited. Retrying after ${retryAfter}s`);
      
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return apiClient(originalRequest);
    }
    
    // Log error
    console.error(
      `[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response.status}`,
      error.response.data
    );
    
    // Normalize error response
    const normalizedError = {
      message: error.response.data?.detail || error.response.data?.message || error.message,
      status: error.response.status,
      data: error.response.data,
      type: 'api_error'
    };
    
    return Promise.reject(normalizedError);
  }
);

/**
 * API Methods
 */
export const api = {
  /**
   * Health check
   */
  async health() {
    const response = await apiClient.get('/api/health');
    return response.data;
  },

  /**
   * Repository operations
   */
  repositories: {
    async list() {
      const response = await apiClient.get('/api/repositories');
      return response.data.repositories;
    },

    async add(url, branch = 'main') {
      const response = await apiClient.post('/api/repositories', { url, branch });
      return response.data;
    },

    async get(id) {
      const response = await apiClient.get(`/api/repositories/${id}`);
      return response.data;
    },

    async delete(id) {
      const response = await apiClient.delete(`/api/repositories/${id}`);
      return response.data;
    }
  },

  /**
   * Pull request operations
   */
  prs: {
    async list(repositoryId = null) {
      const params = repositoryId ? { repository_id: repositoryId } : {};
      const response = await apiClient.get('/api/prs', { params });
      return response.data.prs;
    },

    async get(prId) {
      const response = await apiClient.get(`/api/prs/${prId}`);
      return response.data;
    }
  },

  /**
   * Verification operations
   */
  verification: {
    /**
     * Start a new verification job
     */
    async start(prId, repositoryUrl, prNumber, targetFile = null) {
      const response = await apiClient.post('/api/verify', {
        pr_id: prId,
        repository_url: repositoryUrl,
        pr_number: prNumber,
        target_file: targetFile
      });
      return response.data;
    },

    /**
     * Get verification job status
     */
    async getStatus(jobId) {
      const response = await apiClient.get(`/api/verify/${jobId}`);
      return response.data;
    },

    /**
     * Get verification results
     */
    async getResults(jobId) {
      const response = await apiClient.get(`/api/verify/${jobId}/results`);
      return response.data;
    }
  },

  /**
   * Reports operations
   */
  reports: {
    async list(filters = {}) {
      const response = await apiClient.get('/api/reports', { params: filters });
      return response.data.reports;
    },

    async get(reportId) {
      const response = await apiClient.get(`/api/reports/${reportId}`);
      return response.data;
    }
  }
};

/**
 * Request deduplication cache
 * Prevents multiple identical requests from being sent simultaneously
 */
const pendingRequests = new Map();

/**
 * Deduplicated request wrapper
 * If the same request is already in flight, return the existing promise
 */
export async function deduplicatedRequest(key, requestFn) {
  if (pendingRequests.has(key)) {
    console.log(`[API] Deduplicating request: ${key}`);
    return pendingRequests.get(key);
  }

  const promise = requestFn()
    .finally(() => {
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Simple in-memory cache for GET requests
 */
class ResponseCache {
  constructor(ttl = 60000) { // Default 1 minute TTL
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  clear() {
    this.cache.clear();
  }

  delete(key) {
    this.cache.delete(key);
  }
}

export const responseCache = new ResponseCache();

/**
 * Cached request wrapper
 * Caches GET requests for a specified duration
 */
export async function cachedRequest(key, requestFn, ttl = 60000) {
  // Check cache first
  const cached = responseCache.get(key);
  if (cached) {
    console.log(`[API] Cache hit: ${key}`);
    return cached;
  }

  // Make request and cache result
  const result = await requestFn();
  responseCache.set(key, result);
  return result;
}

/**
 * Batch request helper
 * Combines multiple requests into a single batch
 */
export async function batchRequests(requests) {
  try {
    const results = await Promise.allSettled(requests);
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return { success: true, data: result.value };
      } else {
        return { success: false, error: result.reason };
      }
    });
  } catch (error) {
    console.error('[API] Batch request failed:', error);
    throw error;
  }
}

/**
 * Retry helper with exponential backoff
 */
export async function retryRequest(requestFn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`[API] Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Upload file helper
 */
export async function uploadFile(file, endpoint, onProgress = null) {
  const formData = new FormData();
  formData.append('file', file);

  const config = {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  };

  if (onProgress) {
    config.onUploadProgress = (progressEvent) => {
      const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      onProgress(percentCompleted);
    };
  }

  const response = await apiClient.post(endpoint, formData, config);
  return response.data;
}

/**
 * Download file helper
 */
export async function downloadFile(url, filename) {
  const response = await apiClient.get(url, {
    responseType: 'blob',
  });

  // Create blob link to download
  const blob = new Blob([response.data]);
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  
  // Cleanup
  window.URL.revokeObjectURL(link.href);
}

/**
 * Server-Sent Events (SSE) helper
 * Alternative to WebSocket for one-way streaming
 */
export function createEventSource(url, handlers = {}) {
  const eventSource = new EventSource(`${API_URL}${url}`);

  eventSource.onopen = () => {
    console.log('[SSE] Connection opened');
    handlers.onOpen?.();
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handlers.onMessage?.(data);
    } catch (error) {
      console.error('[SSE] Failed to parse message:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('[SSE] Error:', error);
    handlers.onError?.(error);
    eventSource.close();
  };

  return eventSource;
}

export default api;

// Made with Bob
