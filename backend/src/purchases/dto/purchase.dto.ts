import { PurchaseOrderStatus } from '@prisma/client';
import { IsDateString, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { CreatePurchaseOrderDto } from '../../supplier/dto/purchase-order.dto';

/**
 * Misma forma y validación que el pedido de reposición
 * (supplierId, items[{ partId, quantity, unitPrice? }], replenishmentRequestIds?).
 * El código OC-YYYY-NNN lo genera el servidor.
 */
export class CreatePurchaseDto extends CreatePurchaseOrderDto {}

/**
 * Solo pedidos PENDIENTES cambian de proveedor. Cancelar (`CANCELADA`) aplica
 * a PENDIENTE, CONFIRMADA y RECIBIDA_PARCIAL (cierra lo que falta).
 * La recepción usa POST /api/suppliers/purchase-orders/:id/receive.
 */
export class UpdatePurchaseDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  supplierId?: number;

  @IsOptional()
  @IsIn([PurchaseOrderStatus.CANCELADA], { message: 'El único estado editable es CANCELADA' })
  status?: 'CANCELADA';
}

/** Confirmar (con fecha de entrega) o rechazar un pedido desde el portal. */
export class SupplierPurchaseResponseDto {
  @IsIn([PurchaseOrderStatus.CONFIRMADA, PurchaseOrderStatus.RECHAZADA], {
    message: 'El estado debe ser CONFIRMADA o RECHAZADA',
  })
  status: 'CONFIRMADA' | 'RECHAZADA';

  /** Obligatoria al confirmar. */
  @IsOptional()
  @IsDateString()
  expectedDeliveryAt?: string;
}

/** Informar (o corregir) la fecha de entrega de un pedido confirmado. */
export class DeliveryDateDto {
  @IsDateString()
  expectedDeliveryAt: string;
}
