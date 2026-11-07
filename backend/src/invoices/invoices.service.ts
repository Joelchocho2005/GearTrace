import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma, WorkOrderStatus } from '@prisma/client';
import { isPrismaError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoice.dto';

const INVOICE_INCLUDE = {
  client: { select: { id: true, name: true, email: true } },
  workOrder: { include: { vehicle: true } },
} as const;

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.invoice.findMany({
      include: INVOICE_INCLUDE,
      orderBy: { issuedAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) throw new NotFoundException(`Factura con id ${id} no encontrada`);
    return invoice;
  }

  async create(dto: CreateInvoiceDto) {
    const order = await this.prisma.workOrder.findUnique({
      where: { id: dto.workOrderId },
      include: { vehicle: { select: { ownerId: true } }, invoice: { select: { id: true } } },
    });
    if (!order) {
      throw new NotFoundException(`Orden de trabajo con id ${dto.workOrderId} no encontrada`);
    }
    if (order.status !== WorkOrderStatus.CONCLUIDO) {
      throw new ConflictException('Solo se pueden facturar órdenes de trabajo concluidas');
    }
    if (order.invoice) {
      throw new ConflictException('La orden de trabajo ya tiene una factura');
    }

    if (dto.clientId !== undefined) await this.ensureUser(dto.clientId);
    const clientId = dto.clientId ?? order.vehicle.ownerId;

    const subtotal =
      dto.subtotal !== undefined
        ? new Prisma.Decimal(dto.subtotal)
        : order.finalCost ?? order.estimatedCost;
    if (subtotal === null) {
      throw new BadRequestException(
        'Indica el subtotal: la orden no tiene costo final ni estimado',
      );
    }
    const tax = new Prisma.Decimal(dto.tax ?? 0);

    try {
      return await this.prisma.invoice.create({
        data: {
          number: dto.number,
          workOrderId: dto.workOrderId,
          clientId,
          subtotal,
          tax,
          total: subtotal.plus(tax),
        },
        include: INVOICE_INCLUDE,
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new ConflictException(
          `Ya existe una factura con el número "${dto.number}" o para esta orden`,
        );
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateInvoiceDto) {
    const invoice = await this.findOne(id);
    if (invoice.status === InvoiceStatus.PAGADA) {
      throw new ConflictException('Una factura pagada no puede modificarse');
    }

    const subtotal =
      dto.subtotal !== undefined ? new Prisma.Decimal(dto.subtotal) : invoice.subtotal;
    const tax = dto.tax !== undefined ? new Prisma.Decimal(dto.tax) : invoice.tax;
    const isPaid = dto.status === InvoiceStatus.PAGADA;

    return this.prisma.invoice.update({
      where: { id },
      data: {
        subtotal,
        tax,
        total: subtotal.plus(tax),
        status: dto.status,
        paidAt: isPaid ? new Date() : undefined,
      },
      include: INVOICE_INCLUDE,
    });
  }

  async remove(id: number) {
    const invoice = await this.findOne(id);
    if (invoice.status === InvoiceStatus.PAGADA) {
      throw new ConflictException('No se puede eliminar una factura pagada');
    }
    await this.prisma.invoice.delete({ where: { id } });
  }

  private async ensureUser(id: number) {
    const count = await this.prisma.user.count({ where: { id } });
    if (count === 0) throw new NotFoundException(`Cliente con id ${id} no encontrado`);
  }
}
