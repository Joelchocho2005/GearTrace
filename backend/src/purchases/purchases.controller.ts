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
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/auth.decorators';
import {
  CreatePurchaseDto,
  SupplierPurchaseResponseDto,
  UpdatePurchaseDto,
} from './dto/purchase.dto';
import { PurchasesService } from './purchases.service';

/** /api/purchases — CRUD de órdenes de compra (abastecimiento). */
@Controller('purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GERENTE, Role.BODEGUERO)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  findAll() {
    return this.purchasesService.findAll();
  }

  @Get(':id(\\d+)')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.purchasesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePurchaseDto) {
    return this.purchasesService.create(dto);
  }

  @Patch(':id(\\d+)')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePurchaseDto) {
    return this.purchasesService.update(id, dto);
  }

  @Delete(':id(\\d+)')
  @Roles(Role.GERENTE, Role.BODEGUERO)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.purchasesService.remove(id);
  }

  @Get('supplier-portal')
  @Roles(Role.PROVEEDOR)
  findSupplierOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.purchasesService.findSupplierOrders(user);
  }

  @Patch('supplier-portal/:id(\\d+)')
  @Roles(Role.PROVEEDOR)
  respondAsSupplier(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SupplierPurchaseResponseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchasesService.respondAsSupplier(id, dto, user);
  }
}
