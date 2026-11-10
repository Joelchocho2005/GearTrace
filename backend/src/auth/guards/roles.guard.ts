import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/auth.decorators';
import { AuthenticatedUser } from '../auth.types';

/**
 * RolesGuard
 *
 * Verifica que el usuario autenticado tenga uno de los roles
 * declarados con @Roles() en el endpoint.
 *
 * IMPORTANTE: Siempre debe usarse DESPUÉS de JwtAuthGuard:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *
 * Cada endpoint declara explícitamente sus roles permitidos. El gerente se
 * incluye en las rutas administrativas donde corresponde.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Leer los roles requeridos del decorador @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si el endpoint no tiene @Roles(), está abierto a todos los autenticados
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Verificar si el rol del usuario está en la lista de roles permitidos
    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Acceso denegado. Se requiere uno de los roles: ${requiredRoles.join(', ')}. Tu rol actual es: ${user.role}`,
      );
    }

    return true;
  }
}
