import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, User } from '@prisma/client';
import { hashOptionalPassword, hashPassword, verifyPassword } from '../common/password';
import { rethrowAsConflict } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { assertSupplierLink } from '../users/supplier-link';
import { JwtPayload } from './auth.types';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/** Mensaje genérico: no revela si el correo existe. */
const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos';
const USER_NOT_FOUND = 'Usuario no encontrado';

/** Campos públicos por respuesta (nunca `password`). */
const REGISTERED_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const MANAGED_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type TokenSubject = Pick<User, 'id' | 'email' | 'role' | 'name'>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // ── Registro y login ───────────────────────────────────────

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.count({ where: { email: dto.email } });
    if (exists > 0) {
      throw new ConflictException(`El correo "${dto.email}" ya está registrado`);
    }

    const role = dto.role ?? Role.CLIENTE;
    await assertSupplierLink(this.prisma, role, dto.supplierId);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: await hashPassword(dto.password),
        role,
        supplierId: dto.supplierId,
      },
      select: REGISTERED_USER_SELECT,
    });

    this.logger.log(`Usuario registrado: ${user.email} (${user.role})`);

    return {
      message: 'Usuario registrado exitosamente',
      user,
      ...this.generateTokens(user),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (!(await verifyPassword(dto.password, user.password))) {
      this.logger.warn(`Login fallido para: ${dto.email}`);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    this.logger.log(`Login exitoso: ${user.email} (${user.role})`);

    return {
      message: 'Login exitoso',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      ...this.generateTokens(user),
    };
  }

  // ── Gestión de usuarios (solo GERENTE) ─────────────────────

  findAllUsers() {
    return this.prisma.user.findMany({
      select: MANAGED_USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async toggleUserActive(userId: number, isActive: boolean) {
    await this.ensureUserExists(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
  }

  /** Cambiar solo el rol no permite crear/romper el vínculo con un proveedor. */
  async changeUserRole(userId: number, role: Role) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { supplierId: true },
    });
    if (!current) throw new NotFoundException(USER_NOT_FOUND);
    if (role === Role.PROVEEDOR && !current.supplierId) {
      throw new ConflictException('Asocia un proveedor antes de asignar el rol PROVEEDOR');
    }
    if (role !== Role.PROVEEDOR && current.supplierId) {
      throw new ConflictException('Desvincula el proveedor antes de cambiar este rol');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  async updateUser(userId: number, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, supplierId: true },
    });
    if (!existing) throw new NotFoundException(USER_NOT_FOUND);
    await assertSupplierLink(
      this.prisma,
      dto.role ?? existing.role,
      dto.supplierId ?? existing.supplierId,
    );

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { ...dto, password: await hashOptionalPassword(dto.password) },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      rethrowAsConflict(error, { P2002: 'El correo electrónico ya está registrado' });
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  private async ensureUserExists(id: number) {
    const count = await this.prisma.user.count({ where: { id } });
    if (count === 0) throw new NotFoundException(USER_NOT_FOUND);
  }

  private generateTokens(user: TokenSubject) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
    return { accessToken: this.jwt.sign(payload) };
  }
}
