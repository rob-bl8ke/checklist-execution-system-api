import { AiProviderKey } from '../enums/ai-provider-key.enum';

export interface AiProviderStatus {
  providerKey: AiProviderKey;
  available: boolean;
  transport: 'api' | 'cli';
  supportsChat: boolean;
  supportsPresetActions: boolean;
  supportsStructuredProposal: boolean;
  supportsStreaming: boolean;
  supportedModels: string[];
  unavailableReason?: string;
}

export interface AiProviderStatusResponse {
  providers: AiProviderStatus[];
  defaultProviderKey?: AiProviderKey;
}
