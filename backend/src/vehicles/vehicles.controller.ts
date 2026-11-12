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
import { Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';
import { VehiclesService } from './vehicles.service';
import { WorkOrdersService } from '../work-orders/work-orders.service';

/**
 * /api/vehicles — Vehículos. ERS: registrar/editar/eliminar → GERENTE;
 * consultar e historial → GERENTE y MECANICO.
 */
@Controller('vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GERENTE, Role.MECANICO)
export class VehiclesController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly workOrdersService: WorkOrdersService,
  ) {}

  @Get()
  findAll() {
    return this.vehiclesService.findAll();
  }

  @Get(':id(\\d+)')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vehiclesService.findOne(id);
  }

  /** Consultar historial del vehículo: órdenes con repuestos, actividades y facturas. */
  @Get(':id(\\d+)/history')
  history(@Param('id', ParseIntPipe) id: number) {
    return this.workOrdersService.vehicleHistory(id);
  }

  @Post()
  @Roles(Role.GERENTE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(dto);
  }

  @Patch(':id(\\d+)')
  @Roles(Role.GERENTE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(id, dto);
  }

  @Delete(':id(\\d+)')
  @Roles(Role.GERENTE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.vehiclesService.remove(id);
  }
}
