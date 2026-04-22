import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { AiProviderKey } from '../enums/ai-provider-key.enum';

export class RunAiActionDto {
  @IsEnum(AiProviderKey)
  @IsOptional()
  providerKey?: AiProviderKey;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  userInstruction?: string;

  @IsIn(['ADVICE_ONLY', 'BODY_PROPOSAL_OR_ADVICE'])
  @IsOptional()
  expectedOutput?: 'ADVICE_ONLY' | 'BODY_PROPOSAL_OR_ADVICE';
}
