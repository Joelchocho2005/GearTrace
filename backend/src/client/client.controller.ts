import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ClientService } from './client.service';

@Controller('client')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CLIENTE)
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

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

  @Get('work-orders')
  findMyWorkOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.clientService.findMyWorkOrders(user.id);
  }
}
