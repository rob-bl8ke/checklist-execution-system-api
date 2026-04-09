import { Injectable } from '@nestjs/common';
import { execFileSync } from 'child_process';
import { AiProviderKey } from '../enums/ai-provider-key.enum';
import { AiProviderCapabilities } from '../interfaces/ai-provider.interface';

/**
 * Environment variables used for AI provider configuration:
 *
 * API providers (credentials never exposed in responses):
 *   ANTHROPIC_API_KEY     — Anthropic API key
 *   OPENAI_API_KEY        — OpenAI API key
 *   GOOGLE_API_KEY        — Google (Gemini) API key
 *
 * CLI providers (paths to binaries):
 *   CLAUDE_CLI_PATH       — Path to the `claude` binary (default: 'claude')
 *   COPILOT_CLI_PATH      — Path to the `gh` binary for `gh copilot` (default: 'gh')
 *
 * Defaults:
 *   AI_DEFAULT_PROVIDER   — Default provider key (e.g. 'anthropic-api')
 *   AI_DEFAULT_MODEL      — Default model identifier
 */

@Injectable()
export class ProviderCapabilitiesService {
  private readonly claudeCliPath: string;
  private readonly copilotCliPath: string;
  readonly defaultProviderKey: AiProviderKey | null;
  readonly defaultModel: string | null;

  constructor() {
    this.claudeCliPath = process.env.CLAUDE_CLI_PATH ?? 'claude';
    this.copilotCliPath = process.env.COPILOT_CLI_PATH ?? 'gh';
    this.defaultProviderKey =
      (process.env.AI_DEFAULT_PROVIDER as AiProviderKey) ?? null;
    this.defaultModel = process.env.AI_DEFAULT_MODEL ?? null;
  }

  getCapabilities(providerKey: AiProviderKey): AiProviderCapabilities {
    switch (providerKey) {
      case AiProviderKey.ANTHROPIC_API:
        return this.buildApiCapabilities(
          process.env.ANTHROPIC_API_KEY,
          'ANTHROPIC_API_KEY',
        );

      case AiProviderKey.OPENAI_API:
        return this.buildApiCapabilities(
          process.env.OPENAI_API_KEY,
          'OPENAI_API_KEY',
        );

      case AiProviderKey.GOOGLE_API:
        return this.buildApiCapabilities(
          process.env.GOOGLE_API_KEY,
          'GOOGLE_API_KEY',
        );

      case AiProviderKey.CLAUDE_CODE_CLI:
        return this.buildCliCapabilities(this.claudeCliPath, ['--version']);

      case AiProviderKey.COPILOT_CLI:
        return this.buildCliCapabilities(this.copilotCliPath, [
          'copilot',
          '--version',
        ]);
    }
  }

  getAllCapabilities(): Record<AiProviderKey, AiProviderCapabilities> {
    return {
      [AiProviderKey.ANTHROPIC_API]: this.getCapabilities(
        AiProviderKey.ANTHROPIC_API,
      ),
      [AiProviderKey.OPENAI_API]: this.getCapabilities(AiProviderKey.OPENAI_API),
      [AiProviderKey.GOOGLE_API]: this.getCapabilities(AiProviderKey.GOOGLE_API),
      [AiProviderKey.CLAUDE_CODE_CLI]: this.getCapabilities(
        AiProviderKey.CLAUDE_CODE_CLI,
      ),
      [AiProviderKey.COPILOT_CLI]: this.getCapabilities(
        AiProviderKey.COPILOT_CLI,
      ),
    };
  }

  private buildApiCapabilities(
    apiKey: string | undefined,
    envVarName: string,
  ): AiProviderCapabilities {
    if (!apiKey) {
      return {
        available: false,
        transport: 'api',
        supportsChat: true,
        supportsPresetActions: true,
        supportsStructuredProposal: true,
        supportsStreaming: false,
        unavailableReason: `${envVarName} environment variable is not set`,
      };
    }
    return {
      available: true,
      transport: 'api',
      supportsChat: true,
      supportsPresetActions: true,
      supportsStructuredProposal: true,
      supportsStreaming: false,
    };
  }

  private buildCliCapabilities(
    binaryPath: string,
    args: string[],
  ): AiProviderCapabilities {
    const binaryAvailable = this.isBinaryAvailable(binaryPath, args);
    if (!binaryAvailable) {
      return {
        available: false,
        transport: 'cli',
        supportsChat: false,
        supportsPresetActions: false,
        supportsStructuredProposal: false,
        supportsStreaming: false,
        unavailableReason: `Binary not found or not executable: ${binaryPath}`,
      };
    }
    return {
      available: true,
      transport: 'cli',
      supportsChat: true,
      supportsPresetActions: true,
      supportsStructuredProposal: false,
      supportsStreaming: false,
    };
  }

  private isBinaryAvailable(binaryPath: string, args: string[]): boolean {
    try {
      execFileSync(binaryPath, args, { timeout: 5000, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
}
