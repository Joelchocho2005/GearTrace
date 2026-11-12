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
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { ClientService } from './client.service';
import { OptionalReasonDto } from '../work-orders/dto/work-order.dto';
import { WorkOrdersService } from '../work-orders/work-orders.service';

@Controller('client')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CLIENTE)
export class ClientController {
  constructor(
    private readonly clientService: ClientService,
    private readonly workOrdersService: WorkOrdersService,
  ) {}

  @Get('vehicles')
  findMyVehicles(@CurrentUser() user: AuthenticatedUser) {
    return this.clientService.findMyVehicles(user.id);
  }

  @Get('appointments')
  findMyAppointments(@CurrentUser() user: AuthenticatedUser) {
    return this.clientService.findMyAppointments(user.id);
  }

  @Post('appointments')
  @HttpCode(HttpStatus.CREATED)
  createAppointment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.clientService.createAppointment(user.id, dto);
  }

  /** Reprograma una cita propia (vuelve a AGENDADA). */
  @Patch('appointments/:id(\\d+)')
  rescheduleAppointment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.clientService.rescheduleAppointment(user.id, id, dto);
  }

  /** Cancela una cita propia agendada o confirmada. */
  @Patch('appointments/:id(\\d+)/cancel')
  cancelAppointment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.clientService.cancelAppointment(user.id, id);
  }

  @Get('work-orders')
  findMyWorkOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.clientService.findMyWorkOrders(user.id);
  }

  /** Aprueba el presupuesto de una orden propia (ESPERA_APROBACION → EN_PROCESO). */
  @Patch('work-orders/:id(\\d+)/quote/approve')
  approveQuote(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.workOrdersService.decideQuote(id, true, undefined, user);
  }

  /** Rechaza el presupuesto: la orden queda CANCELADA. */
  @Patch('work-orders/:id(\\d+)/quote/reject')
  rejectQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: OptionalReasonDto,
  ) {
    return this.workOrdersService.decideQuote(id, false, dto.reason, user);
  }
}
