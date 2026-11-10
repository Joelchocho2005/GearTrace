import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Patch,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles, CurrentUser } from './decorators/auth.decorators';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Rutas públicas (sin autenticación) ────────────────────

  /** POST /api/auth/login */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /api/auth/register
   * Registro público: solo crea usuarios con rol CLIENTE.
   * Para crear MECANICO/GERENTE usar el endpoint de admin.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    // Forzar CLIENTE en registro público
    return this.authService.register({ ...dto, role: Role.CLIENTE, supplierId: undefined });
  }

  // ── Rutas autenticadas ─────────────────────────────────────

  /** GET /api/auth/me → Perfil del usuario logueado */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  // ── Rutas exclusivas del GERENTE ──────────────────────────

  /** GET /api/auth/users → Lista todos los usuarios */
  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GERENTE)
  findAllUsers() {
    return this.authService.findAllUsers();
  }

  /**
   * POST /api/auth/admin/create → El gerente crea usuarios con cualquier rol
   */
  @Post('admin/create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GERENTE)
  @HttpCode(HttpStatus.CREATED)
  adminCreateUser(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /** PATCH /api/auth/users/:id/role → Cambiar rol de un usuario */
  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GERENTE)
  changeRole(
    @Param('id', ParseIntPipe) id: number,
    @Body('role') role: Role,
  ) {
    return this.authService.changeUserRole(id, role);
  }

  /** PATCH /api/auth/users/:id → Editar el perfil completo de un usuario */
  @Patch('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GERENTE)
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.authService.updateUser(id, dto);
  }

  /** PATCH /api/auth/users/:id/toggle → Activar/desactivar usuario */
  @Patch('users/:id/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.GERENTE)
  toggleActive(
    @Param('id', ParseIntPipe) id: number,
    @Body('isActive') isActive: boolean,
  ) {
    return this.authService.toggleUserActive(id, isActive);
  }
}
