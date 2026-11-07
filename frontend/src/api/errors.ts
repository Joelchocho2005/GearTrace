import { isAxiosError } from 'axios';

/** Extrae el mensaje de error de NestJS (string o arreglo de class-validator). */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join('. ');
    if (message) return message;
  }
  return fallback;
}
