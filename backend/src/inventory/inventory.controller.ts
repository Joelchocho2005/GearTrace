import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreatePartDto } from './dto/create-part.dto';
import { CreateBoxDto } from './dto/create-box.dto';
import { UpdatePartDto } from './dto/update-part.dto';
import { UpdateBoxDto } from './dto/update-box.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ── Boxes ─────────────────────────────────────────────────

  /** GET /api/inventory/boxes → Lista todas las cajas con sus piezas */
  @Get('boxes')
  findAllBoxes() {
    return this.inventoryService.findAllBoxes();
  }

  /** GET /api/inventory/boxes/:id → Detalle de una caja */
  @Get('boxes/:id')
  findOneBox(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.findOneBox(id);
  }

  /** POST /api/inventory/boxes → Crear nueva caja */
  @Post('boxes')
  @HttpCode(HttpStatus.CREATED)
  createBox(@Body() dto: CreateBoxDto) {
    return this.inventoryService.createBox(dto);
  }

  /** PATCH /api/inventory/boxes/:id → Actualizar una caja */
  @Patch('boxes/:id')
  updateBox(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBoxDto,
  ) {
    return this.inventoryService.updateBox(id, dto);
  }

  /** DELETE /api/inventory/boxes/:id → Eliminar una caja vacía */
  @Delete('boxes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeBox(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.removeBox(id);
  }

  // ── Parts ─────────────────────────────────────────────────

  /** GET /api/inventory/parts → Lista todas las piezas */
  @Get('parts')
  findAllParts() {
    return this.inventoryService.findAllParts();
  }

  /** GET /api/inventory/parts/low-stock → Piezas bajo stock mínimo */
  @Get('parts/low-stock')
  getLowStockParts() {
    return this.inventoryService.getLowStockParts();
  }

  /** GET /api/inventory/parts/:id → Detalle de una pieza */
  @Get('parts/:id')
  findOnePart(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.findOnePart(id);
  }

  /** POST /api/inventory/parts → Crear nueva pieza */
  @Post('parts')
  @HttpCode(HttpStatus.CREATED)
  createPart(@Body() dto: CreatePartDto) {
    return this.inventoryService.createPart(dto);
  }

  /** PATCH /api/inventory/parts/:id → Actualizar una pieza */
  @Patch('parts/:id')
  updatePart(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePartDto,
  ) {
    return this.inventoryService.updatePart(id, dto);
  }

  /** DELETE /api/inventory/parts/:id → Eliminar una pieza */
  @Delete('parts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePart(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.removePart(id);
  }

  /** GET /api/inventory/search/:query → Búsqueda de piezas (usado internamente y por Alexa) */
  @Get('search/:query')
  searchPart(@Param('query') query: string) {
    return this.inventoryService.searchPartByName(query);
  }
}
