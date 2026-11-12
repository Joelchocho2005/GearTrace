import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateInvoiceDto, RegisterPaymentDto, UpdateInvoiceDto, VoidInvoiceDto } from './dto/invoice.dto';
import { InvoicesService } from './invoices.service';

/**
 * /api/invoices — Facturación (FIN). ERS: generar cargos, emitir, registrar
 * pago → CONTADOR; consultar comprobantes/transacciones y anular → CONTADOR y
 * GERENTE. Las facturas no se eliminan (se anulan).
 */
@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GERENTE, Role.CONTADOR)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  findAll() {
    return this.invoicesService.findAll();
  }

  /**
   * GET /api/invoices/billable-orders → órdenes concluidas sin factura activa.
   * El CONTADOR no tiene acceso a /api/work-orders, por eso existe esta ruta.
   */
  @Get('billable-orders')
  findBillableOrders() {
    return this.invoicesService.findBillableOrders();
  }

  /** GET /api/invoices/charges/:workOrderId → Consultar cargos (vista previa). */
  @Get('charges/:workOrderId(\\d+)')
  previewCharges(@Param('workOrderId', ParseIntPipe) workOrderId: number) {
    return this.invoicesService.previewCharges(workOrderId);
  }

  /** GET /api/invoices/payments → Consultar transacciones. */
  @Get('payments')
  findPayments() {
    return this.invoicesService.findPayments();
  }

  @Get(':id(\\d+)')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.invoicesService.findOne(id);
  }

  @Post()
  @Roles(Role.CONTADOR, Role.GERENTE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.create(dto, user);
  }

  @Patch(':id(\\d+)')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateInvoiceDto) {
    return this.invoicesService.update(id, dto);
  }

  @Post(':id(\\d+)/payments')
  @HttpCode(HttpStatus.CREATED)
  registerPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegisterPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.registerPayment(id, dto, user);
  }

  @Patch(':id(\\d+)/void')
  voidInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VoidInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.voidInvoice(id, dto.reason, user);
  }
}
