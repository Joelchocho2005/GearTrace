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
import {
  CloseWorkOrderDto,
  CreateWorkOrderDto,
  DiagnoseWorkOrderDto,
  UpdateWorkOrderStatusDto,
} from './dto/work-order.dto';
import { ServiceService } from './service.service';

@Controller('service')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MECANICO, Role.GERENTE)
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Get('vehicles')
  findVehicles() {
    return this.serviceService.findVehicles();
  }

  @Get('vehicles/:id')
  findVehicle(@Param('id', ParseIntPipe) id: number) {
    return this.serviceService.findVehicle(id);
  }

  @Post('vehicles')
  @HttpCode(HttpStatus.CREATED)
  createVehicle(@Body() dto: CreateVehicleDto) {
    return this.serviceService.createVehicle(dto);
  }

  @Patch('vehicles/:id')
  updateVehicle(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.serviceService.updateVehicle(id, dto);
  }

  @Delete('vehicles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeVehicle(@Param('id', ParseIntPipe) id: number) {
    return this.serviceService.removeVehicle(id);
  }

  @Get('work-orders')
  findWorkOrders() {
    return this.serviceService.findWorkOrders();
  }

  @Post('work-orders')
  @HttpCode(HttpStatus.CREATED)
  createWorkOrder(@Body() dto: CreateWorkOrderDto) {
    return this.serviceService.createWorkOrder(dto);
  }

  @Patch('work-orders/:id/status')
  updateWorkOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkOrderStatusDto,
  ) {
    return this.serviceService.updateWorkOrderStatus(id, dto.status);
  }

  @Patch('work-orders/:id/diagnosis')
  diagnoseWorkOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DiagnoseWorkOrderDto,
  ) {
    return this.serviceService.diagnoseWorkOrder(id, dto.diagnosis);
  }

  @Patch('work-orders/:id/close')
  closeWorkOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloseWorkOrderDto,
  ) {
    return this.serviceService.closeWorkOrder(id, dto.finalCost);
  }
}
