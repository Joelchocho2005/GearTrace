import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

@Injectable()
export class ClientService {
  constructor(private readonly prisma: PrismaService) {}

  findMyVehicles(ownerId: number) {
    return this.prisma.vehicle.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAppointment(ownerId: number, dto: CreateAppointmentDto) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, ownerId },
    });
    if (!vehicle) {
      throw new NotFoundException('El vehículo no pertenece al cliente autenticado');
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('La cita debe agendarse para una fecha futura');
    }

    return this.prisma.appointment.create({
      data: {
        scheduledAt,
        reason: dto.reason,
        vehicleId: dto.vehicleId,
      },
      include: { vehicle: true },
    });
  }

  findMyWorkOrders(ownerId: number) {
    return this.prisma.workOrder.findMany({
      where: { vehicle: { ownerId } },
      include: {
        vehicle: true,
        mechanic: { select: { id: true, name: true, email: true } },
        parts: { include: { part: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
