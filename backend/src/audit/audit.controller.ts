import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

/** /api/audit-logs — Auditoría de cambios (GERENTE). */
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GERENTE)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findRecent(@Query() query: AuditQueryDto) {
    return this.auditService.findRecent(query.entity);
  }
}
