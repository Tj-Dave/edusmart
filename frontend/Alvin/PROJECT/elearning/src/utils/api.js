// client/src/utils/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let queue = [];
const processQueue = (err, token = null) =>
  queue.forEach((p) => (err ? p.reject(err) : p.resolve(token)));

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const orig = err.config;
    if (err.response?.status === 401 && err.response?.data?.expired && !orig._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => queue.push({ resolve, reject }))
          .then((token) => { orig.headers.Authorization = `Bearer ${token}`; return api(orig); });
      }
      orig._retry    = true;
      isRefreshing   = true;
      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        localStorage.setItem('accessToken', data.accessToken);
        processQueue(null, data.accessToken);
        orig.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(orig);
      } catch (e) {
        processQueue(e, null);
        localStorage.clear();
        window.location.href = '/';
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
        queue = [];
      }
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login:    (d) => api.post('/auth/login',    d),
  register: (d) => api.post('/auth/register', d),
  logout:   ()  => api.post('/auth/logout'),
  me:       ()  => api.get('/auth/me'),
};

export const studentApi = {
  getDashboard: ()    => api.get('/student/dashboard'),
  saveQuery:    (d)   => api.post('/student/save-query', d),
};

export default api;