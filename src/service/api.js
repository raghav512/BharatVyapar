// Network layer: shared HTTP client and interceptors.

import axios from 'axios';
import config from '../config';
import {
  getStoredToken,
  getStoredRefreshToken,
  saveAuthSession,
  removeAuthSession,
  getStoredAuthSession, // ✅ ADDED
} from './auth/authStorage';

let onUnauthorizedCallback = null;
export const setUnauthorizedCallback = cb => {
  onUnauthorizedCallback = cb;
};

const api = axios.create({
  baseURL: config.API_BASE_URL,
  timeout: config.API_TIMEOUT,
});

// ================= REQUEST =================
api.interceptors.request.use(async reqConfig => {
  const token = await getStoredToken();

  reqConfig.headers = reqConfig.headers ?? {};

  if (token) {
    reqConfig.headers.Authorization = `Bearer ${token}`;
  }

  if (reqConfig.data instanceof FormData) {
    delete reqConfig.headers['Content-Type'];
  } else if (reqConfig.data) {
    reqConfig.headers['Content-Type'] = 'application/json';
  }

  if (__DEV__) {
    console.log('📤', reqConfig.method?.toUpperCase(), reqConfig.url);
  }

  return reqConfig;
});

// ================= RESPONSE =================
let isRefreshing = false;
let failedQueue = [];
let refreshFailureCount = 0;

const flushQueue = (token, error) => {
  failedQueue.forEach(p => {
    token ? p.resolve(token) : p.reject(error);
  });
  failedQueue = [];
};

const forceLogout = async () => {
  console.log('🔴 Session expired / No refresh token'); // 👈 add this

  await removeAuthSession();
  if (onUnauthorizedCallback) onUnauthorizedCallback();
};

api.interceptors.response.use(
  res => res,
  async error => {
    const original = error.config || {};
    const statusCode = error.response?.status;

    // Let abort/cancel errors pass through untouched
    if (axios.isCancel(error)) return Promise.reject(error);

    if (__DEV__) {
      console.log('[NET][RES][ERR]', {
        statusCode,
        method: original?.method?.toUpperCase?.(),
        url: original?.url,
        data: error.response?.data || null,
      });
    }

    if (!error.response) {
      return Promise.reject({
        message: 'No internet connection',
        type: 'NETWORK_ERROR',
        statusCode: null,
        backendError: null,
      });
    }

    if (statusCode === 401 && original._retry) {
      const sessionExpiredError = {
        message: 'Session expired. Please login again.',
        type: 'SESSION_EXPIRED',
      };

      flushQueue(null, sessionExpiredError);
      await forceLogout();
      refreshFailureCount = 0;

      return Promise.reject(sessionExpiredError);
    }

    if (statusCode === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          original.headers = original.headers ?? {};
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await getStoredRefreshToken();

        // ✅ EDGE CASE HANDLE
        if (!refreshToken) {
          const sessionExpiredError = {
            message: 'Session expired. Please login again.',
            type: 'SESSION_EXPIRED',
          };

          flushQueue(null, sessionExpiredError);
          await forceLogout();
          refreshFailureCount = 0;

          return Promise.reject(sessionExpiredError);
        }

        const res = await axios.post(`${config.API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const newToken = res.data.token;
        const newRefreshToken = res.data.refreshToken || refreshToken;

        const session = await getStoredAuthSession();

        await saveAuthSession({
          ...session,
          token: newToken,
          refreshToken: newRefreshToken,
        });

        refreshFailureCount = 0;
        flushQueue(newToken, null);

        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (err) {
        refreshFailureCount += 1;

        const refreshFailureError = {
          message: err?.message || 'Session refresh failed',
          type: 'SESSION_REFRESH_FAILED',
        };

        flushQueue(null, refreshFailureError);

        if (refreshFailureCount >= 2) {
          const sessionExpiredError = {
            message: 'Session expired. Please login again.',
            type: 'SESSION_EXPIRED',
          };

          await forceLogout();
          refreshFailureCount = 0;

          return Promise.reject(sessionExpiredError);
        }

        return Promise.reject(refreshFailureError);
      } finally {
        isRefreshing = false;
        refreshFailureCount = 0;
      }
    }

    return Promise.reject({
      message: error.response?.data?.message || 'Something went wrong',
      type: 'API_ERROR',
      statusCode,
      backendError: error.response?.data || null,
    });
  },
);

export default api;
