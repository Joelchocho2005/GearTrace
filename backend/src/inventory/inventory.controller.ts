import {
  Controller,
  Get,
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

  /** GET /api/inventory/search/:query → Búsqueda de piezas (usado internamente y por Alexa) */
  @Get('search/:query')
  searchPart(@Param('query') query: string) {
    return this.inventoryService.searchPartByName(query);
  }
}
