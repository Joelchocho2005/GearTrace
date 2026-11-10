import { PurchaseOrderStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { CreatePurchaseOrderDto } from '../../supplier/dto/purchase-order.dto';

/**
 * Misma forma y validación que el pedido de reposición existente
 * (supplierId, items[{ partId, quantity, unitPrice? }]). El código OC-YYYY-NNN
 * lo genera el servidor.
 */
export class CreatePurchaseDto extends CreatePurchaseOrderDto {}

/**
 * Solo pedidos PENDIENTES pueden editarse. Estado admitido: CANCELADA.
 * La recepción (RECIBIDA) incrementa stock y se hace en
 * POST /api/suppliers/purchase-orders/:id/receive.
 */
export class UpdatePurchaseDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  supplierId?: number;

  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;
}

export class SupplierPurchaseResponseDto {
  @IsEnum(PurchaseOrderStatus, {
    message: 'El estado debe ser CONFIRMADA o RECHAZADA',
  })
  status: 'CONFIRMADA' | 'RECHAZADA';

  @IsOptional()
  @IsDateString()
  expectedDeliveryAt?: string;
}
