import axios from 'axios';

// Instancia de axios preconfigurada
const api = axios.create({
  baseURL: '/api', // Vite proxy redirige a http://localhost:3000/api
});

// Interceptor para inyectar el token JWT en cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('geartrace_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores globalmente (ej. 401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Si el token expira, limpiamos localstorage y forzamos login
      localStorage.removeItem('geartrace_token');
      localStorage.removeItem('geartrace_user');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
