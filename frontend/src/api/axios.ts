import axios from 'axios';
axios.defaults.headers.common['ngrok-skip-browser-warning'] = '69420';
// Obtener la URL base desde la variable de entorno o usar fallback por defecto
const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Asegurar que la URL base incluya el prefijo /api requerido por el backend NestJS
const baseURL = rawApiUrl.endsWith('/api')
  ? rawApiUrl
  : `${rawApiUrl.replace(/\/$/, '')}/api`;

// Instancia de axios preconfigurada
const api = axios.create({
  baseURL,
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
