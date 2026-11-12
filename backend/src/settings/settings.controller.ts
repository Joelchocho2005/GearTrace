import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

/**
 * /api/settings — Parámetros del taller (tarifa de mano de obra, impuesto,
 * capacidad de agenda). Lectura: personal interno; edición: GERENTE.
 */
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GERENTE)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles(Role.GERENTE, Role.MECANICO, Role.CONTADOR, Role.BODEGUERO)
  get() {
    return this.settingsService.get();
  }

  @Patch()
  update(@Body() dto: UpdateSettingsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.update(dto, user.id);
  }
}
