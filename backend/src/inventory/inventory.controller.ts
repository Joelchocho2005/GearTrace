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
  ParseFilePipe,
  FileTypeValidator,
  MaxFileSizeValidator,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { InventoryService } from './inventory.service';
import { CreatePartDto } from './dto/create-part.dto';
import { CreateBoxDto } from './dto/create-box.dto';
import { UpdatePartDto } from './dto/update-part.dto';
import { UpdateBoxDto } from './dto/update-box.dto';
import { Roles } from '../auth/decorators/auth.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

/**
 * Inventario: solo personal del taller autenticado. Alexa no usa estas rutas
 * (consume InventoryService directamente desde /api/webhook/alexa).
 * Eliminar cajas o piezas queda reservado al GERENTE.
 */
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GERENTE, Role.BODEGUERO)
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
  @Roles(Role.GERENTE, Role.BODEGUERO)
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

  /** POST /api/inventory/parts/:id/image → Subir imagen de una pieza */
  @Post('parts/:id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads'),
        filename: (_request, file, callback) => {
          callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
        },
      }),
    }),
  )
  uploadPartImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /^image\/(jpeg|png|gif|webp)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.inventoryService.updatePartPhoto(id, `/uploads/${file.filename}`);
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
  @Roles(Role.GERENTE, Role.BODEGUERO)
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
