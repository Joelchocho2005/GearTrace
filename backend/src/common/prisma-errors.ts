import { Prisma } from '@prisma/client';

/** P2002: violación de restricción única. P2003: violación de llave foránea. */
export type PrismaErrorCode = 'P2002' | 'P2003';

export function isPrismaError(error: unknown, code: PrismaErrorCode): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
