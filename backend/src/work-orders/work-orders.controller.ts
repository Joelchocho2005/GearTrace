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
import {
  AddUsedPartDto,
  CreateWorkOrderDto,
  UpdateWorkOrderDto,
} from './dto/work-order.dto';
import { WorkOrdersService } from './work-orders.service';

/**
 * /api/work-orders — Órdenes de trabajo (SER).
 * GERENTE ve y gestiona todas; MECANICO solo las asignadas a él (@CurrentUser).
 */
@Controller('work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GERENTE, Role.MECANICO)
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.workOrdersService.findAll(user);
  }

  @Get(':id(\\d+)')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.findOne(id, user);
  }

  /** RF-SER-05: genera el código OT-YYYY-NNN. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateWorkOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.create(dto, user);
  }

  /** RF-INV-13: agrega un repuesto consumido y descuenta stock (transacción). */
  @Post(':id(\\d+)/parts')
  @HttpCode(HttpStatus.CREATED)
  addUsedPart(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddUsedPartDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.addUsedPart(id, dto, user);
  }

  @Patch(':id(\\d+)')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.update(id, dto, user);
  }

  @Delete(':id(\\d+)')
  @Roles(Role.GERENTE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.remove(id, user);
  }
}
