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
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  ApproveReplenishmentDto,
  CreateReplenishmentRequestDto,
  RejectReplenishmentDto,
  ReplenishmentQueryDto,
} from './dto/replenishment.dto';
import { ReplenishmentService } from './replenishment.service';

/**
 * /api/replenishment-requests — Solicitar reposición (GERENTE, BODEGUERO,
 * MECANICO); aprobar/rechazar (GERENTE).
 */
@Controller('replenishment-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GERENTE, Role.BODEGUERO, Role.MECANICO)
export class ReplenishmentController {
  constructor(private readonly replenishmentService: ReplenishmentService) {}

  @Get()
  findAll(@Query() query: ReplenishmentQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.replenishmentService.findAll(user, query.status);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateReplenishmentRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.replenishmentService.create(dto, user);
  }

  @Patch(':id(\\d+)/approve')
  @Roles(Role.GERENTE)
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveReplenishmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.replenishmentService.approve(id, dto.note, user);
  }

  @Patch(':id(\\d+)/reject')
  @Roles(Role.GERENTE)
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectReplenishmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.replenishmentService.reject(id, dto.note, user);
  }
}
