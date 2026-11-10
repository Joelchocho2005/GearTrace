import { isAxiosError } from 'axios';

/** Error de validación de un formulario: su mensaje se muestra tal cual al usuario. */
export class UserInputError extends Error {}

/** Extrae el mensaje de error de NestJS (string o arreglo de class-validator). */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join('. ');
    if (message) return message;
  }
  if (error instanceof UserInputError) return error.message;
  return fallback;
}
