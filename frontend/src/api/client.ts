import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('rag_token');
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('rag_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);
