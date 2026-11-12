import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  AddUsedPartDto,
  AssignMechanicDto,
  CreateServiceActivityDto,
  CreateWorkOrderDto,
  OptionalReasonDto,
  ReasonDto,
  SendQuoteDto,
  UpdateWorkOrderDto,
  WorkOrderQueryDto,
} from './dto/work-order.dto';
import { WorkOrdersService } from './work-orders.service';

/**
 * /api/work-orders — Órdenes de trabajo (SER).
 * ERS: registrar, asignar, entregar y cancelar → GERENTE. Diagnóstico,
 * presupuesto, avance, actividades, repuestos y cierre → MECANICO (solo las
 * asignadas a él, `workOrderScope`) y GERENTE.
 */
@Controller('work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GERENTE, Role.MECANICO)
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  /** `?unassigned=true` (GERENTE): órdenes abiertas sin mecánico. */
  @Get()
  findAll(@Query() query: WorkOrderQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workOrdersService.findAll(user, query.unassigned === 'true');
  }

  @Get(':id(\\d+)')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.workOrdersService.findOne(id, user);
  }

  /** RF-SER-05: genera el código OT-YYYY-NNN. */
  @Post()
  @Roles(Role.GERENTE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateWorkOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workOrdersService.create(dto, user);
  }

  @Patch(':id(\\d+)/assign')
  @Roles(Role.GERENTE)
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignMechanicDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.assignMechanic(id, dto.mechanicId, user);
  }

  /** EN_DIAGNOSTICO → ESPERA_APROBACION (diagnóstico + presupuesto). */
  @Post(':id(\\d+)/quote')
  sendQuote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.sendQuote(id, dto, user);
  }

  /** El GERENTE registra la aprobación del cliente (p. ej. telefónica). */
  @Patch(':id(\\d+)/quote/approve')
  @Roles(Role.GERENTE)
  approveQuote(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.workOrdersService.decideQuote(id, true, undefined, user);
  }

  @Patch(':id(\\d+)/quote/reject')
  @Roles(Role.GERENTE)
  rejectQuote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: OptionalReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.decideQuote(id, false, dto.reason, user);
  }

  /** RF-INV-13: registra un repuesto, descuenta stock (kardex) y enciende su LED. */
  @Post(':id(\\d+)/parts')
  @HttpCode(HttpStatus.CREATED)
  addUsedPart(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddUsedPartDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.addUsedPart(id, dto, user);
  }

  /** Quita un repuesto y devuelve su stock (transacción). */
  @Delete(':id(\\d+)/parts/:partId(\\d+)')
  removeUsedPart(
    @Param('id', ParseIntPipe) id: number,
    @Param('partId', ParseIntPipe) partId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.removeUsedPart(id, partId, user);
  }

  /** Registrar actividad de servicio (horas → mano de obra). */
  @Post(':id(\\d+)/activities')
  @HttpCode(HttpStatus.CREATED)
  addActivity(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateServiceActivityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.addActivity(id, dto, user);
  }

  @Delete(':id(\\d+)/activities/:activityId(\\d+)')
  removeActivity(
    @Param('id', ParseIntPipe) id: number,
    @Param('activityId', ParseIntPipe) activityId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.removeActivity(id, activityId, user);
  }

  /** Cierre técnico: CONCLUIDO con finalCost calculado (no recibe precios). */
  @Patch(':id(\\d+)/close')
  close(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.workOrdersService.close(id, user);
  }

  /** CONCLUIDO → ENTREGADA (requiere factura activa). */
  @Patch(':id(\\d+)/deliver')
  @Roles(Role.GERENTE)
  deliver(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.workOrdersService.deliver(id, user);
  }

  /** Cancela una orden abierta y devuelve sus repuestos al inventario. */
  @Patch(':id(\\d+)/cancel')
  @Roles(Role.GERENTE)
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.cancel(id, dto.reason, user);
  }

  @Patch(':id(\\d+)')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.update(id, dto, user);
  }

  /** Solo órdenes recién creadas sin historial; con historial → cancelar. */
  @Delete(':id(\\d+)')
  @Roles(Role.GERENTE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.workOrdersService.remove(id, user);
  }
}
