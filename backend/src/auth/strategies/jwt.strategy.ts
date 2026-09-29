import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload, AuthenticatedUser } from '../auth.types';
import { UnauthorizedException } from '@nestjs/common';

/**
 * JwtStrategy
 *
 * Passport strategy para validar JWT en cada request.
 * El JWT se extrae del header: Authorization: Bearer <token>
 *
 * validate() se llama automáticamente en cada request protegido.
 * El valor retornado se asigna a req.user.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'geartrace-dev-secret-change-in-production'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Verificar que el usuario sigue existiendo y activo en la BD
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, name: true, isActive: true },
    });

    if (!user || !user.isActive) {
      this.logger.warn(`Token válido pero usuario ${payload.sub} inactivo o eliminado`);
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    // Este objeto estará disponible en req.user en todos los endpoints
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
  }
}
