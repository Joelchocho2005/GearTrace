import { Role } from '@prisma/client';

/** Se deriva del enum de Prisma: agregar un rol no exige tocar los DTOs. */
export const ROLE_VALIDATION_MESSAGE = `El rol debe ser uno de: ${Object.values(Role).join(', ')}`;
