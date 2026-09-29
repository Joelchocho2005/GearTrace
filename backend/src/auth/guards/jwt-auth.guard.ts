import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtAuthGuard
 *
 * Protege endpoints verificando el JWT en el header Authorization.
 * Si el token es inválido o no existe → 401 Unauthorized.
 *
 * Uso:
 *   @UseGuards(JwtAuthGuard)
 *   @Get('perfil')
 *   getProfile() { ... }
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  override handleRequest<TUser>(err: Error, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException(
        'Token inválido o expirado. Por favor, inicia sesión nuevamente.',
      );
    }
    return user;
  }
}
