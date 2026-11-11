import * as bcrypt from 'bcryptjs';

/** Costo de bcrypt. Único punto de configuración para todo el backend. */
export const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Para actualizaciones parciales: `undefined` deja la contraseña como está. */
export async function hashOptionalPassword(plain?: string): Promise<string | undefined> {
  return plain ? hashPassword(plain) : undefined;
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
