import { PurchaseOrderStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CreatePurchaseOrderDto } from '../../supplier/dto/purchase-order.dto';

/**
 * Misma forma y validación que el pedido de reposición existente
 * (number, supplierId, items[{ partId, quantity, unitPrice? }]).
 */
export class CreatePurchaseDto extends CreatePurchaseOrderDto {}

/**
 * Solo pedidos PENDIENTES pueden editarse. Estado admitido: CANCELADA.
 * La recepción (RECIBIDA) incrementa stock y se hace en
 * POST /api/suppliers/purchase-orders/:id/receive.
 */
export class UpdatePurchaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  number?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  supplierId?: number;

  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;
}
