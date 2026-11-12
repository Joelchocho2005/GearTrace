import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
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
import { CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { AuthenticatedUser } from '../auth/auth.types';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { MovementsQueryDto } from './dto/movements-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

/**
 * Inventario: solo personal del taller autenticado. Alexa no usa estas rutas
 * (consume InventoryService directamente desde /api/webhook/alexa).
 * ERS: consultar inventario/buscar/localizar también MECANICO (solo lectura);
 * registrar, actualizar, ajustar stock y ubicaciones: GERENTE y BODEGUERO.
 */
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GERENTE, Role.BODEGUERO)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ── Boxes ─────────────────────────────────────────────────

  /** GET /api/inventory/boxes → Lista todas las cajas con sus piezas */
  @Get('boxes')
  @Roles(Role.GERENTE, Role.BODEGUERO, Role.MECANICO)
  findAllBoxes() {
    return this.inventoryService.findAllBoxes();
  }

  /** GET /api/inventory/boxes/:id → Detalle de una caja */
  @Get('boxes/:id')
  @Roles(Role.GERENTE, Role.BODEGUERO, Role.MECANICO)
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

  /** GET /api/inventory/parts → Lista todas las piezas (Consultar inventario) */
  @Get('parts')
  @Roles(Role.GERENTE, Role.BODEGUERO, Role.MECANICO)
  findAllParts() {
    return this.inventoryService.findAllParts();
  }

  /** GET /api/inventory/parts/low-stock → Piezas bajo stock mínimo */
  @Get('parts/low-stock')
  getLowStockParts() {
    return this.inventoryService.getLowStockParts();
  }

  /** GET /api/inventory/movements?partId= → Kardex (movimientos de stock) */
  @Get('movements')
  movements(@Query() query: MovementsQueryDto) {
    return this.inventoryService.findMovements(query.partId);
  }

  /** GET /api/inventory/parts/:id → Detalle de una pieza */
  @Get('parts/:id')
  @Roles(Role.GERENTE, Role.BODEGUERO, Role.MECANICO)
  findOnePart(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.findOnePart(id);
  }

  /** POST /api/inventory/parts → Crear nueva pieza */
  @Post('parts')
  @HttpCode(HttpStatus.CREATED)
  createPart(@Body() dto: CreatePartDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.createPart(dto, user.id);
  }

  /** POST /api/inventory/parts/:id/adjust → Ajuste de stock con motivo (kardex) */
  @Post('parts/:id/adjust')
  adjustStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdjustStockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.adjustStock(id, dto, user.id);
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

  /**
   * POST /api/inventory/parts/:id/locate → Enciende el LED de su caja.
   * También MECANICO (desde la búsqueda de su panel), igual que con Alexa.
   */
  @Post('parts/:id/locate')
  @Roles(Role.GERENTE, Role.BODEGUERO, Role.MECANICO)
  @HttpCode(HttpStatus.ACCEPTED)
  locatePart(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.locatePart(id);
  }

  /** PATCH /api/inventory/parts/:id → Actualizar una pieza */
  @Patch('parts/:id')
  updatePart(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePartDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.updatePart(id, dto, user.id);
  }

  /** DELETE /api/inventory/parts/:id → Eliminar una pieza */
  @Delete('parts/:id')
  @Roles(Role.GERENTE, Role.BODEGUERO)
  @HttpCode(HttpStatus.NO_CONTENT)
  removePart(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.removePart(id);
  }

  /**
   * GET /api/inventory/search/:query → Búsqueda de piezas (máx. 5).
   * También MECANICO: busca repuestos en su panel y al registrarlos en una OT.
   * Alexa no pasa por aquí (usa InventoryService directamente).
   */
  @Get('search/:query')
  @Roles(Role.GERENTE, Role.BODEGUERO, Role.MECANICO)
  searchPart(@Param('query') query: string) {
    return this.inventoryService.searchPartByName(query);
  }
}
