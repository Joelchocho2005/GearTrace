import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SearchLogService } from './search-log.service';

/** /api/logs — Historial de búsquedas (personal del taller autenticado). */
@Controller('logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GERENTE, Role.MECANICO)
export class SearchLogController {
  constructor(private readonly searchLogService: SearchLogService) {}

  @Get()
  findRecent() {
    return this.searchLogService.findRecent();
  }
}
