import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseOrderItemDto {
  @IsInt()
  @Min(1)
  partId: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;
}

/** El código `number` (OC-YYYY-NNN) lo genera el servidor; no se acepta en el body. */
export class CreatePurchaseOrderDto {
  @IsInt()
  @Min(1)
  supplierId: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'El pedido debe contener al menos una pieza' })
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}
