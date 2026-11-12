import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreatePurchaseOrderDto, ReceivePurchaseOrderDto } from './dto/purchase-order.dto';
import { SupplierService } from './supplier.service';

/**
 * Flujo de reposición: stock bajo, pedidos y recepción (GERENTE, BODEGUERO).
 * El CRUD de proveedores y su catálogo vive en SuppliersController.
 */
@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GERENTE, Role.BODEGUERO)
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Get('low-stock')
  findLowStockParts() {
    return this.supplierService.findLowStockParts();
  }

  @Get('purchase-orders')
  findPurchaseOrders() {
    return this.supplierService.findPurchaseOrders();
  }

  @Post('purchase-orders')
  @HttpCode(HttpStatus.CREATED)
  createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.supplierService.createPurchaseOrder(dto, user);
  }

  /** Recepción total (sin body) o parcial (`items`). */
  @Post('purchase-orders/:id(\\d+)/receive')
  receivePurchaseOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceivePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplierService.receivePurchaseOrder(id, dto, user);
  }
}
