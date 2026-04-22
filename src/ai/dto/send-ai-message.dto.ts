import { IsEnum, IsIn, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { AiProviderKey } from '../enums/ai-provider-key.enum';

export class SendAiMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(AiProviderKey)
  @IsOptional()
  providerKey?: AiProviderKey;

  @IsString()
  @IsOptional()
  model?: string;

  @IsIn(['ADVICE_ONLY', 'BODY_PROPOSAL_OR_ADVICE'])
  @IsOptional()
  expectedOutput?: 'ADVICE_ONLY' | 'BODY_PROPOSAL_OR_ADVICE';
}
