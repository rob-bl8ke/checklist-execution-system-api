import { Injectable } from '@nestjs/common';
import { AiGenerateRequest } from '../interfaces/ai-generate-request.interface';
import { AiGenerateResult } from '../interfaces/ai-generate-result.interface';
import { ProviderFactory } from '../providers/provider.factory';
import { ProviderCapabilitiesService } from './provider-capabilities.service';
import { PromptTemplateService } from './prompt-template.service';
import { AiProviderKey } from '../enums/ai-provider-key.enum';

@Injectable()
export class PromptRunnerService {
  constructor(
    private readonly providerFactory: ProviderFactory,
    private readonly providerCapabilities: ProviderCapabilitiesService,
    private readonly promptTemplate: PromptTemplateService,
  ) {}

  /**
   * Orchestrates the full AI interaction pipeline:
   *  1. Resolve the provider key (request override → default → Anthropic)
   *  2. Check provider availability
   *  3. Assemble the canonical prompt
   *  4. Dispatch to the provider
   *  5. Return the normalized AiGenerateResult
   */
  async run(
    request: AiGenerateRequest,
    providerKeyOverride?: AiProviderKey,
    customSystemPrompt?: string,
  ): Promise<AiGenerateResult> {
    const providerKey = this.resolveProviderKey(providerKeyOverride);

    const capabilities = this.providerCapabilities.getCapabilities(providerKey);
    if (!capabilities.available) {
      throw new Error(
        `AI provider '${providerKey}' is not available: ${capabilities.unavailableReason ?? 'unknown reason'}`,
      );
    }

    // Assemble canonical prompt and inject into request
    const assembled = this.promptTemplate.assemble(request, customSystemPrompt);

    const dispatchRequest: AiGenerateRequest = {
      ...request,
      history: assembled.history,
      userMessage: assembled.userMessage,
      systemPrompt: assembled.systemPrompt,
    };

    const provider = this.providerFactory.getProvider(providerKey);
    return provider.generate(dispatchRequest);
  }

  private resolveProviderKey(override?: AiProviderKey): AiProviderKey {
    if (override) return override;
    if (this.providerCapabilities.defaultProviderKey) {
      return this.providerCapabilities.defaultProviderKey;
    }
    // Fall back to Anthropic as the recommended default
    return AiProviderKey.ANTHROPIC_API;
  }
}
