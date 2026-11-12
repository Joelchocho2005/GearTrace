import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Appointment, AppointmentStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { toFutureDate } from '../common/dates';
import { USER_SUMMARY, WORK_ORDER_SUMMARY } from '../common/selects';
import { AppointmentChangedEvent, DOMAIN_EVENTS } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { assertSlotAvailable, lockAgenda } from './appointment-capacity';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';

const APPOINTMENT_INCLUDE = {
  vehicle: { include: { owner: USER_SUMMARY } },
  workOrder: WORK_ORDER_SUMMARY,
} as const;

/** Estados finales: la cita ya no se edita. */
const FINAL_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.COMPLETADA,
  AppointmentStatus.CANCELADA,
  AppointmentStatus.NO_ASISTIO,
];

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

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

  /** Programar cita (GERENTE): fecha futura y con cupo en la agenda. */
  async create(dto: CreateAppointmentDto, userId: number) {
    await this.ensureVehicle(dto.vehicleId);
    const scheduledAt = toFutureDate(dto.scheduledAt);
    const appointment = await this.prisma.$transaction(async (tx) => {
      await lockAgenda(tx);
      await assertSlotAvailable(tx, await this.settings.get(tx), scheduledAt);
      const created = await tx.appointment.create({
        data: { scheduledAt, reason: dto.reason, vehicleId: dto.vehicleId, status: AppointmentStatus.CONFIRMADA },
        include: APPOINTMENT_INCLUDE,
      });
      await this.audit.record(
        { action: 'APPOINTMENT_CREATED', entity: 'Appointment', entityId: created.id, userId },
        tx,
      );
      return created;
    });
    this.emitChanged(appointment, appointment.vehicle.ownerId);
    return appointment;
  }

  /**
   * Programar/confirmar/reprogramar (GERENTE). Reglas:
   *  - Citas finales no se editan.
   *  - COMPLETADA solo vía "Generar OT" (POST /:id/work-order).
   *  - NO_ASISTIO solo si la hora de la cita ya pasó.
   *  - Una nueva fecha debe ser futura y tener cupo.
   */
  async update(id: number, dto: UpdateAppointmentDto, userId: number) {
    const current = await this.findOne(id);
    if (FINAL_STATUSES.includes(current.status)) {
      throw new ConflictException('Una cita completada, cancelada o marcada como no asistida no puede modificarse');
    }
    if (dto.status === AppointmentStatus.COMPLETADA) {
      throw new BadRequestException('Una cita se completa al generar su orden de trabajo (POST /api/appointments/:id/work-order)');
    }
    if (dto.status === AppointmentStatus.NO_ASISTIO && current.scheduledAt > new Date()) {
      throw new ConflictException('Solo se marca "No asistió" cuando ya pasó la hora de la cita');
    }
    if (dto.vehicleId !== undefined) await this.ensureVehicle(dto.vehicleId);
    const scheduledAt = dto.scheduledAt ? toFutureDate(dto.scheduledAt) : undefined;

    const appointment = await this.prisma.$transaction(async (tx) => {
      if (scheduledAt) {
        await lockAgenda(tx);
        await assertSlotAvailable(tx, await this.settings.get(tx), scheduledAt, id);
      }
      const updated = await tx.appointment.update({
        where: { id },
        data: { ...dto, scheduledAt },
        include: APPOINTMENT_INCLUDE,
      });
      if (dto.status !== undefined && dto.status !== current.status) {
        await this.audit.record(
          {
            action: 'APPOINTMENT_STATUS',
            entity: 'Appointment',
            entityId: id,
            userId,
            detail: { from: current.status, to: dto.status },
          },
          tx,
        );
      }
      return updated;
    });
    this.emitChanged(appointment, appointment.vehicle.ownerId);
    return appointment;
  }

  /** Solo se eliminan citas sin OT generada; el historial se conserva cancelando. */
  async remove(id: number, userId: number) {
    const appointment = await this.findOne(id);
    if (appointment.workOrder) {
      throw new ConflictException('La cita ya generó una orden de trabajo; no puede eliminarse');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.appointment.delete({ where: { id } });
      await this.audit.record({ action: 'APPOINTMENT_DELETED', entity: 'Appointment', entityId: id, userId }, tx);
    });
  }

  private emitChanged(appointment: Appointment, ownerId: number) {
    const event: AppointmentChangedEvent = {
      appointmentId: appointment.id,
      ownerId,
      status: appointment.status,
      scheduledAt: appointment.scheduledAt,
    };
    this.events.emit(DOMAIN_EVENTS.APPOINTMENT_CHANGED, event);
  }

  private async ensureVehicle(id: number) {
    const count = await this.prisma.vehicle.count({ where: { id } });
    if (count === 0) throw new NotFoundException(`Vehículo con id ${id} no encontrado`);
  }
}
