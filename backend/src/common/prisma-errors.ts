import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** P2002: violación de restricción única. P2003: violación de llave foránea. */
export type PrismaErrorCode = 'P2002' | 'P2003';

export function isPrismaError(error: unknown, code: PrismaErrorCode): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/**
 * Traduce errores conocidos de Prisma a `409 Conflict` con un mensaje de
 * negocio; cualquier otro error se relanza tal cual. Uso:
 *
 *   } catch (error) {
 *     rethrowAsConflict(error, { P2002: 'El correo ya está registrado' });
 *   }
 */
export function rethrowAsConflict(
  error: unknown,
  messages: Partial<Record<PrismaErrorCode, string>>,
): never {
  for (const [code, message] of Object.entries(messages) as [PrismaErrorCode, string][]) {
    if (isPrismaError(error, code)) throw new ConflictException(message);
  }
  throw error;
}
