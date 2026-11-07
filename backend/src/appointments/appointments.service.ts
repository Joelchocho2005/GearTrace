import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';

const APPOINTMENT_INCLUDE = {
  vehicle: {
    include: { owner: { select: { id: true, name: true, email: true } } },
  },
} as const;

const FINAL_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.COMPLETADA,
  AppointmentStatus.CANCELADA,
];

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.appointment.findMany({
      include: APPOINTMENT_INCLUDE,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findOne(id: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: APPOINTMENT_INCLUDE,
    });
    if (!appointment) throw new NotFoundException(`Cita con id ${id} no encontrada`);
    return appointment;
  }

  async create(dto: CreateAppointmentDto) {
    await this.ensureVehicle(dto.vehicleId);
    return this.prisma.appointment.create({
      data: {
        scheduledAt: this.toFutureDate(dto.scheduledAt),
        reason: dto.reason,
        vehicleId: dto.vehicleId,
      },
      include: APPOINTMENT_INCLUDE,
    });
  }

  async update(id: number, dto: UpdateAppointmentDto) {
    const appointment = await this.findOne(id);
    if (FINAL_STATUSES.includes(appointment.status)) {
      throw new ConflictException('Una cita completada o cancelada no puede modificarse');
    }
    if (dto.vehicleId !== undefined) await this.ensureVehicle(dto.vehicleId);

    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...dto,
        scheduledAt: dto.scheduledAt ? this.toFutureDate(dto.scheduledAt) : undefined,
      },
      include: APPOINTMENT_INCLUDE,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.appointment.delete({ where: { id } });
  }

  private toFutureDate(value: string): Date {
    const date = new Date(value);
    if (date <= new Date()) {
      throw new BadRequestException('La cita debe agendarse para una fecha futura');
    }
    return date;
  }

  private async ensureVehicle(id: number) {
    const count = await this.prisma.vehicle.count({ where: { id } });
    if (count === 0) throw new NotFoundException(`Vehículo con id ${id} no encontrado`);
  }
}
