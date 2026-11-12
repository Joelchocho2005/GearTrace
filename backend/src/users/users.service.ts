import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { hashOptionalPassword, hashPassword } from '../common/password';
import { rethrowAsConflict } from '../common/prisma-errors';
import { USER_SUMMARY_SELECT } from '../common/selects';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { updateUserReleasingOrders } from './mechanic-status';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { assertSupplierLink } from './supplier-link';

const DUPLICATE_EMAIL = 'El correo electrónico ya está registrado';

/** Campos públicos: nunca se expone `password`. */
export const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  supplierId: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

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
      select: USER_SUMMARY_SELECT,
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
    const role = dto.role ?? Role.CLIENTE;
    await assertSupplierLink(this.prisma, role, dto.supplierId);
    try {
      return await this.prisma.user.create({
        data: { ...dto, role, password: await hashPassword(dto.password) },
        select: USER_SELECT,
      });
    } catch (error) {
      rethrowAsConflict(error, { P2002: DUPLICATE_EMAIL });
    }
  }

  async update(id: number, dto: UpdateUserDto) {
    const current = await this.prisma.user.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    await assertSupplierLink(
      this.prisma,
      dto.role ?? current.role,
      dto.supplierId ?? current.supplierId,
    );
    const password = await hashOptionalPassword(dto.password);
    try {
      return await updateUserReleasingOrders(this.prisma, this.events, id, (tx) =>
        tx.user.update({ where: { id }, data: { ...dto, password }, select: USER_SELECT }),
      );
    } catch (error) {
      rethrowAsConflict(error, { P2002: DUPLICATE_EMAIL });
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
      rethrowAsConflict(error, {
        P2003: 'El usuario tiene vehículos o facturas asociadas; desactívalo en lugar de eliminarlo',
      });
    }
  }
}
