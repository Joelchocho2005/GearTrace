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
import { CreateSupplierDto, UpdateSupplierDto, UpsertSupplierPartDto } from './dto/supplier.dto';
import { SuppliersService } from './suppliers.service';

/**
 * /api/suppliers — Proveedores y su catálogo. ERS: registrar/editar/eliminar
 * proveedor → GERENTE; consultar → GERENTE, BODEGUERO; catálogo → consulta
 * también MECANICO, mantenimiento GERENTE y BODEGUERO.
 * Comparte prefijo con SupplierController (low-stock y purchase-orders); el
 * parámetro `:id(\\d+)` evita que capture esas rutas literales.
 */
@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GERENTE, Role.BODEGUERO)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @Roles(Role.GERENTE, Role.BODEGUERO, Role.MECANICO)
  findAll() {
    return this.suppliersService.findAll();
  }

  /** GET /api/suppliers/catalog/by-part/:partId → ofertas por pieza. */
  @Get('catalog/by-part/:partId(\\d+)')
  @Roles(Role.GERENTE, Role.BODEGUERO, Role.MECANICO)
  findOffersForPart(@Param('partId', ParseIntPipe) partId: number) {
    return this.suppliersService.findOffersForPart(partId);
  }

  @Get(':id(\\d+)')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.suppliersService.findOne(id);
  }

  @Get(':id(\\d+)/catalog')
  @Roles(Role.GERENTE, Role.BODEGUERO, Role.MECANICO)
  findCatalog(@Param('id', ParseIntPipe) id: number) {
    return this.suppliersService.findCatalog(id);
  }

  /** Alta o actualización de una pieza en el catálogo (upsert por pieza). */
  @Post(':id(\\d+)/catalog')
  upsertCatalogItem(@Param('id', ParseIntPipe) id: number, @Body() dto: UpsertSupplierPartDto) {
    return this.suppliersService.upsertCatalogItem(id, dto);
  }

  @Delete(':id(\\d+)/catalog/:partId(\\d+)')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCatalogItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('partId', ParseIntPipe) partId: number,
  ) {
    return this.suppliersService.removeCatalogItem(id, partId);
  }

  @Post()
  @Roles(Role.GERENTE)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  @Patch(':id(\\d+)')
  @Roles(Role.GERENTE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(id, dto);
  }

  @Delete(':id(\\d+)')
  @Roles(Role.GERENTE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.suppliersService.remove(id);
  }
}
