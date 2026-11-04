import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtPayload } from './auth.types';
import { Role } from '@prisma/client';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ──────────────────────────────────────────────────────────
  // REGISTER
  // ──────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    // Verificar que el correo no esté en uso
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) {
      throw new ConflictException(
        `El correo "${dto.email}" ya está registrado`,
      );
    }

    // Hashear la contraseña con bcrypt
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: dto.role ?? Role.CLIENTE,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    this.logger.log(`✅ Usuario registrado: ${user.email} (${user.role})`);

    return {
      message: 'Usuario registrado exitosamente',
      user,
      ...this.generateTokens(user),
    };
  }

  // ──────────────────────────────────────────────────────────
  // LOGIN
  // ──────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Mensaje genérico para no revelar si el email existe
    const invalidMsg = 'Correo o contraseña incorrectos';

    if (!user || !user.isActive) {
      throw new UnauthorizedException(invalidMsg);
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      this.logger.warn(`Login fallido para: ${dto.email}`);
      throw new UnauthorizedException(invalidMsg);
    }

    this.logger.log(`🔑 Login exitoso: ${user.email} (${user.role})`);

    return {
      message: 'Login exitoso',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      ...this.generateTokens(user),
    };
  }

  // ──────────────────────────────────────────────────────────
  // GESTIÓN DE USUARIOS (solo GERENTE)
  // ──────────────────────────────────────────────────────────

  async findAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async toggleUserActive(userId: number, isActive: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
  }

  async changeUserRole(userId: number, role: Role) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  // ──────────────────────────────────────────────────────────
  // JWT helpers
  // ──────────────────────────────────────────────────────────

  private generateTokens(user: {
    id: number;
    email: string;
    role: Role;
    name: string;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessToken = this.jwt.sign(payload);

    return { accessToken };
  }
}
