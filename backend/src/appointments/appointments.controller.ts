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
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateWorkOrderFromAppointmentDto } from '../work-orders/dto/work-order.dto';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';

/**
 * /api/appointments — Agenda del taller (personal).
 * El CLIENTE agenda sus propias citas en POST /api/client/appointments.
 */
@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GERENTE, Role.MECANICO)
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly workOrdersService: WorkOrdersService,
  ) {}

  @Get()
  findAll() {
    return this.appointmentsService.findAll();
  }

  @Get(':id(\\d+)')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(dto);
  }

  /** Cita → OT: crea la orden de trabajo desde la cita y la marca COMPLETADA. */
  @Post(':id(\\d+)/work-order')
  @HttpCode(HttpStatus.CREATED)
  createWorkOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateWorkOrderFromAppointmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.createFromAppointment(id, dto, user);
  }

  @Patch(':id(\\d+)')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(id, dto);
  }

  @Delete(':id(\\d+)')
  @Roles(Role.GERENTE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.remove(id);
  }
}
