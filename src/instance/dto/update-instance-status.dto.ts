import { IsEnum } from 'class-validator';
import { InstanceStatus } from '../enums/instance-status.enum';

export class UpdateInstanceStatusDto {
  @IsEnum(InstanceStatus)
  status: InstanceStatus;
}
