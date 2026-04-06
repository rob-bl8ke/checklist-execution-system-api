import { AiProviderKey } from '../enums/ai-provider-key.enum';
import { AiGenerateRequest } from './ai-generate-request.interface';
import { AiGenerateResult } from './ai-generate-result.interface';

export interface AiProviderCapabilities {
  available: boolean;
  transport: 'api' | 'cli';
  supportsChat: boolean;
  supportsPresetActions: boolean;
  supportsStructuredProposal: boolean;
  supportsStreaming: boolean;
  unavailableReason?: string;
}

export interface IAiProvider {
  key: AiProviderKey;
  capabilities: AiProviderCapabilities;
  generate(request: AiGenerateRequest): Promise<AiGenerateResult>;
}
