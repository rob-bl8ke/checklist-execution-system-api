import { Module } from '@nestjs/common';
import { AiProviderKey } from './enums/ai-provider-key.enum';
import { AiTargetType } from './enums/ai-target-type.enum';
import { ProviderCapabilitiesService } from './services/provider-capabilities.service';
import { ToolExecutorService } from './services/tool-executor.service';
import { ApiClientFactoryService } from './services/api-client-factory.service';
import { ResponseNormalizerService } from './services/response-normalizer.service';
import { PromptTemplateService } from './services/prompt-template.service';
import { PromptRunnerService } from './services/prompt-runner.service';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { GoogleProvider } from './providers/google.provider';
import { ClaudeCodeProvider } from './providers/claude-code.provider';
import { CopilotProvider } from './providers/copilot.provider';
import { ProviderFactory } from './providers/provider.factory';

export { AiProviderKey, AiTargetType };

@Module({
  imports: [],
  controllers: [],
  providers: [
    ProviderCapabilitiesService,
    ToolExecutorService,
    ApiClientFactoryService,
    ResponseNormalizerService,
    PromptTemplateService,
    PromptRunnerService,
    AnthropicProvider,
    OpenAIProvider,
    GoogleProvider,
    ClaudeCodeProvider,
    CopilotProvider,
    ProviderFactory,
  ],
  exports: [
    ProviderCapabilitiesService,
    ToolExecutorService,
    ApiClientFactoryService,
    ResponseNormalizerService,
    PromptTemplateService,
    PromptRunnerService,
    ProviderFactory,
  ],
})
export class AiModule {}
