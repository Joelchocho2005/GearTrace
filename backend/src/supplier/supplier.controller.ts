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
import { Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreatePurchaseOrderDto } from './dto/purchase-order.dto';
import { SupplierService } from './supplier.service';

/**
 * Flujo de reposición: stock bajo, pedidos y recepción.
 * GET/POST /api/suppliers (CRUD de proveedores) vive en SuppliersController.
 */
@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GERENTE, Role.MECANICO)
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
  createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto) {
    return this.supplierService.createPurchaseOrder(dto);
  }

  @Post('purchase-orders/:id/receive')
  receivePurchaseOrder(@Param('id', ParseIntPipe) id: number) {
    return this.supplierService.receivePurchaseOrder(id);
  }
}
