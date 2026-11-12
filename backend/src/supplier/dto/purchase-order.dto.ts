import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseOrderItemDto {
  @IsInt()
  @Min(1)
  partId: number;

  @IsInt()
  @Min(1)
  quantity: number;

  /** Por defecto: precio del catálogo del proveedor (SupplierPart.price). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;
}

/**
 * Crear pedido de reposición. El código OC-YYYY-NNN lo genera el servidor.
 * Cada pieza debe estar en el catálogo del proveedor y, o bien en/bajo su
 * stock mínimo, o bien cubierta por una solicitud APROBADA incluida en
 * `replenishmentRequestIds` (que pasa a ATENDIDA).
 */
export class CreatePurchaseOrderDto {
  @IsInt()
  @Min(1)
  supplierId: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'El pedido debe contener al menos una pieza' })
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  replenishmentRequestIds?: number[];
}

export class ReceiveItemDto {
  @IsInt()
  @Min(1)
  itemId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

/**
 * Registrar recepción de pedido. Sin `items` se recibe todo lo pendiente;
 * con `items` se registra una recepción parcial por ítem.
 */
export class ReceivePurchaseOrderDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemDto)
  items?: ReceiveItemDto[];
}
