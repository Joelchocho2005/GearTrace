import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreatePartDto } from './create-part.dto';

/**
 * `quantity` no se edita aquí: todo cambio de stock pasa por el kardex
 * (POST /api/inventory/parts/:id/adjust, OT o recepción de compras).
 */
export class UpdatePartDto extends PartialType(OmitType(CreatePartDto, ['quantity'] as const)) {}
