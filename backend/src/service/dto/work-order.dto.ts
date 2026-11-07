import { WorkOrderStatus } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/** Fuente única: el código OT-YYYY-NNN lo genera WorkOrdersService (RF-SER-05). */
export { CreateWorkOrderDto, WorkOrderPartDto } from '../../work-orders/dto/work-order.dto';

export class UpdateWorkOrderStatusDto {
  @IsEnum(WorkOrderStatus)
  status: WorkOrderStatus;
}

export class DiagnoseWorkOrderDto {
  @IsString()
  diagnosis: string;
}

export class CloseWorkOrderDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  finalCost?: number;
}
