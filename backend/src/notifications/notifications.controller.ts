import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NotificationsService } from './notifications.service';

/** /api/notifications — Bandeja propia de cualquier usuario autenticado. */
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...Object.values(Role))
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.findMine(user.id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Patch(':id(\\d+)/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markRead(id, user.id);
  }
}
