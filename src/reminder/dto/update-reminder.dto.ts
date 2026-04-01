import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ReminderCadence } from '../enums/reminder-cadence.enum';

export class UpdateReminderDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsEnum(ReminderCadence)
  cadence?: ReminderCadence;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  interval?: number;

  @IsOptional()
  @IsDateString()
  anchorDate?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @ArrayUnique()
  weekdays?: number[];

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  timeOfDay?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  leadTimeDays?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  linkedTemplateId?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
