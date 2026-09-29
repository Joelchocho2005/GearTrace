import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorador @Roles() para declarar qué roles pueden acceder a un endpoint.
 *
 * Uso:
 *   @Roles(Role.GERENTE, Role.MECANICO)
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Get('endpoint-protegido')
 *   getEndpoint() { ... }
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Decorador @CurrentUser() para extraer el usuario autenticado del request.
 *
 * Uso:
 *   getProfile(@CurrentUser() user: AuthenticatedUser) { ... }
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
