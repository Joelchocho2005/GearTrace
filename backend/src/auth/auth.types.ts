import { Role } from '@prisma/client';

/**
 * Payload que se firma dentro del JWT.
 * Debe ser mínimo para no exponer datos sensibles.
 */
export interface JwtPayload {
  sub: number;    // User ID (estándar JWT)
  email: string;
  role: Role;
  name: string;
}

/**
 * Datos del usuario autenticado disponibles en los guards y decoradores.
 * Se adjunta en req.user por la JwtStrategy.
 */
export interface AuthenticatedUser {
  id: number;
  email: string;
  role: Role;
  name: string;
}
