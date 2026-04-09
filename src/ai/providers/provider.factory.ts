import { Injectable } from '@nestjs/common';
import { AiProviderKey } from '../enums/ai-provider-key.enum';
import { IAiProvider } from '../interfaces/ai-provider.interface';
import { AnthropicProvider } from './anthropic.provider';
import { OpenAIProvider } from './openai.provider';
import { GoogleProvider } from './google.provider';
import { ClaudeCodeProvider } from './claude-code.provider';
import { CopilotProvider } from './copilot.provider';

@Injectable()
export class ProviderFactory {
  private readonly registry: Map<AiProviderKey, IAiProvider>;

  constructor(
    private readonly anthropic: AnthropicProvider,
    private readonly openai: OpenAIProvider,
    private readonly google: GoogleProvider,
    private readonly claudeCode: ClaudeCodeProvider,
    private readonly copilot: CopilotProvider,
  ) {
    this.registry = new Map([
      [AiProviderKey.ANTHROPIC_API, anthropic],
      [AiProviderKey.OPENAI_API, openai],
      [AiProviderKey.GOOGLE_API, google],
      [AiProviderKey.CLAUDE_CODE_CLI, claudeCode],
      [AiProviderKey.COPILOT_CLI, copilot],
    ]);
  }

  getProvider(key: AiProviderKey): IAiProvider {
    const provider = this.registry.get(key);
    if (!provider) {
      throw new Error(`No provider registered for key: ${key}`);
    }
    return provider;
  }

  getAllProviders(): IAiProvider[] {
    return Array.from(this.registry.values());
  }
}
