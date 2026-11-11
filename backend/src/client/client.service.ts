import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { toFutureDate } from '../common/dates';
import { USER_SUMMARY, WORK_ORDER_SUMMARY } from '../common/selects';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';

const CLIENT_APPOINTMENT_INCLUDE = { vehicle: true, workOrder: WORK_ORDER_SUMMARY } as const;

/** Solo una cita aún abierta puede reprogramarse o cancelarse. */
const OPEN_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  AppointmentStatus.AGENDADA,
  AppointmentStatus.CONFIRMADA,
];

@Injectable()
export class ClientService {
  constructor(private readonly prisma: PrismaService) {}

  findMyVehicles(ownerId: number) {
    return this.prisma.vehicle.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findMyAppointments(ownerId: number) {
    return this.prisma.appointment.findMany({
      where: { vehicle: { ownerId } },
      include: CLIENT_APPOINTMENT_INCLUDE,
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async createAppointment(ownerId: number, dto: CreateAppointmentDto) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, ownerId },
    });
    if (!vehicle) {
      throw new NotFoundException('El vehículo no pertenece al cliente autenticado');
    }

    return this.prisma.appointment.create({
      data: {
        scheduledAt: toFutureDate(dto.scheduledAt),
        reason: dto.reason,
        vehicleId: dto.vehicleId,
      },
      include: { vehicle: true },
    });
  }

  /**
   * Reprograma una cita propia. Vuelve a AGENDADA para que el taller
   * confirme el nuevo horario.
   */
  async rescheduleAppointment(ownerId: number, id: number, dto: RescheduleAppointmentDto) {
    await this.findOpenAppointment(ownerId, id);
    return this.prisma.appointment.update({
      where: { id },
      data: {
        scheduledAt: toFutureDate(dto.scheduledAt),
        reason: dto.reason,
        status: AppointmentStatus.AGENDADA,
      },
      include: CLIENT_APPOINTMENT_INCLUDE,
    });
  }

  async cancelAppointment(ownerId: number, id: number) {
    await this.findOpenAppointment(ownerId, id);
    return this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELADA },
      include: CLIENT_APPOINTMENT_INCLUDE,
    });
  }

  findMyWorkOrders(ownerId: number) {
    return this.prisma.workOrder.findMany({
      where: { vehicle: { ownerId } },
      include: {
        vehicle: true,
        mechanic: USER_SUMMARY,
        parts: { include: { part: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Cita de un vehículo del cliente (ajena → 404) que siga abierta (si no → 409). */
  private async findOpenAppointment(ownerId: number, id: number) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, vehicle: { ownerId } },
      select: { status: true },
    });
    if (!appointment) throw new NotFoundException(`Cita con id ${id} no encontrada`);
    if (!OPEN_APPOINTMENT_STATUSES.includes(appointment.status)) {
      throw new ConflictException('Solo se pueden modificar citas agendadas o confirmadas');
    }
    return appointment;
  }
}
