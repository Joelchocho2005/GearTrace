import axios, { AxiosError } from 'axios';
import { API_BASE_URL } from './config';
import { AUTH_UNAUTHORIZED_EVENT, clearSession, getToken } from './session';

const UNEXPECTED_HTML_MESSAGE =
  'El servidor respondió HTML en lugar de JSON (posible página de advertencia de ngrok o túnel caído). Revisa VITE_API_URL.';

// Instancia de axios preconfigurada.
// `ngrok-skip-browser-warning` (cualquier valor) evita que ngrok responda su
// página HTML de advertencia en lugar del JSON. Se fija en la instancia, no en
// axios.defaults, para no afectar a otras peticiones fuera de la API.
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'ngrok-skip-browser-warning': 'true',
  },
});

// Inyecta el token JWT en cada request.
api.interceptors.request.use((config) => {
  const token = getToken();
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
      return Promise.reject(
        new AxiosError(UNEXPECTED_HTML_MESSAGE, 'ERR_UNEXPECTED_HTML', response.config, response.request, {
          ...response,
          data: { message: UNEXPECTED_HTML_MESSAGE },
        }),
      );
    }
    return response;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      clearSession();
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error);
  },
);

export default api;
