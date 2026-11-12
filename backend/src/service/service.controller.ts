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
import { VehiclesService } from '../vehicles/vehicles.service';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';
import {
  CreateWorkOrderDto,
  DiagnoseWorkOrderDto,
  UpdateWorkOrderStatusDto,
} from './dto/work-order.dto';

/**
 * Rutas legadas /api/service/* (compatibilidad). No contienen lógica: delegan
 * en VehiclesService/WorkOrdersService (misma máquina de estados, mismos
 * roles del ERS y mismo alcance por mecánico).
 */
@Controller('service')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MECANICO, Role.GERENTE)
export class ServiceController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly workOrdersService: WorkOrdersService,
  ) {}

  @Get('vehicles')
  findVehicles() {
    return this.vehiclesService.findAll();
  }

  @Get('vehicles/:id')
  findVehicle(@Param('id', ParseIntPipe) id: number) {
    return this.vehiclesService.findOne(id);
  }

  @Post('vehicles')
  @Roles(Role.GERENTE)
  @HttpCode(HttpStatus.CREATED)
  createVehicle(@Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(dto);
  }

  @Patch('vehicles/:id')
  @Roles(Role.GERENTE)
  updateVehicle(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(id, dto);
  }

  @Delete('vehicles/:id')
  @Roles(Role.GERENTE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeVehicle(@Param('id', ParseIntPipe) id: number) {
    return this.vehiclesService.remove(id);
  }

  @Get('work-orders')
  findWorkOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.workOrdersService.findAll(user);
  }

  @Post('work-orders')
  @Roles(Role.GERENTE)
  @HttpCode(HttpStatus.CREATED)
  createWorkOrder(@Body() dto: CreateWorkOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workOrdersService.create(dto, user);
  }

  @Patch('work-orders/:id/status')
  updateWorkOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.changeStatus(id, dto.status, user);
  }

  @Patch('work-orders/:id/diagnosis')
  diagnoseWorkOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DiagnoseWorkOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.diagnose(id, dto.diagnosis, user);
  }

  /** Cierre técnico; el costo final lo calcula el servidor (no se recibe). */
  @Patch('work-orders/:id/close')
  closeWorkOrder(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.workOrdersService.close(id, user);
  }
}
