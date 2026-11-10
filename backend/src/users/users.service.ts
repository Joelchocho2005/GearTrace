import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { isPrismaError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

const BCRYPT_ROUNDS = 10;

/** Campos públicos: nunca se expone `password`. */
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Usuarios activos de un rol con datos mínimos (id, nombre, correo). */
  lookup(role: Role) {
    return this.prisma.user.findMany({
      where: { role, isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    return user;
  }

  async create(dto: CreateUserDto) {
    try {
      return await this.prisma.user.create({
        data: {
          ...dto,
          role: dto.role ?? Role.CLIENTE,
          password: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        },
        select: USER_SELECT,
      });
    } catch (error) {
      this.throwDuplicateEmail(error);
      throw error;
    }
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.findOne(id);
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...dto,
          password: dto.password
            ? await bcrypt.hash(dto.password, BCRYPT_ROUNDS)
            : undefined,
        },
        select: USER_SELECT,
      });
    } catch (error) {
      this.throwDuplicateEmail(error);
      throw error;
    }
  }

  async remove(id: number, currentUserId: number) {
    if (id === currentUserId) {
      throw new ConflictException('No puedes eliminar tu propio usuario');
    }
    await this.findOne(id);
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      if (isPrismaError(error, 'P2003')) {
        throw new ConflictException(
          'El usuario tiene vehículos o facturas asociadas; desactívalo en lugar de eliminarlo',
        );
      }
      throw error;
    }
  }

  private throwDuplicateEmail(error: unknown) {
    if (isPrismaError(error, 'P2002')) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }
  }
}
