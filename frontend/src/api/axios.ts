import axios, { AxiosError } from 'axios';

// Obtener la URL base desde la variable de entorno o usar fallback por defecto
const rawApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

// Asegurar que la URL base incluya el prefijo /api requerido por el backend NestJS
const baseURL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

// Instancia de axios preconfigurada.
// `ngrok-skip-browser-warning` (cualquier valor) evita que ngrok responda su
// página HTML de advertencia en lugar del JSON. Se fija en la instancia, no en
// axios.defaults, para no afectar a otras peticiones fuera de la API.
const api = axios.create({
  baseURL,
  headers: {
    'ngrok-skip-browser-warning': 'true',
  },
});

// Interceptor para inyectar el token JWT en cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('geartrace_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor de respuesta:
//  - HTML con status 200 = el túnel (ngrok) respondió una página en vez de la API.
//    Se convierte en error explícito para no romper vistas que esperan JSON.
//  - 401 = sesión expirada: limpia la sesión y avisa a AuthContext.
api.interceptors.response.use(
  (response) => {
    const contentType = String(response.headers['content-type'] ?? '');
    if (contentType.includes('text/html')) {
      const message =
        'El servidor respondió HTML en lugar de JSON (posible página de advertencia de ngrok o túnel caído). Revisa VITE_API_URL.';
      return Promise.reject(
        new AxiosError(message, 'ERR_UNEXPECTED_HTML', response.config, response.request, {
          ...response,
          data: { message },
        }),
      );
    }
    return response;
  },
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
