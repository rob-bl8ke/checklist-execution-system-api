import { ProviderFactory } from './provider.factory';
import { AnthropicProvider } from './anthropic.provider';
import { OpenAIProvider } from './openai.provider';
import { GoogleProvider } from './google.provider';
import { ClaudeCodeProvider } from './claude-code.provider';
import { CopilotProvider } from './copilot.provider';
import { ToolExecutorService } from '../services/tool-executor.service';
import { AiProviderKey } from '../enums/ai-provider-key.enum';

function makeFactory(): ProviderFactory {
  const toolExecutor = { execute: jest.fn() } as unknown as ToolExecutorService;
  return new ProviderFactory(
    new AnthropicProvider(),
    new OpenAIProvider(),
    new GoogleProvider(),
    new ClaudeCodeProvider(toolExecutor),
    new CopilotProvider(toolExecutor),
  );
}

describe('ProviderFactory', () => {
  let factory: ProviderFactory;

  beforeEach(() => {
    factory = makeFactory();
  });

  it.each([
    AiProviderKey.ANTHROPIC_API,
    AiProviderKey.OPENAI_API,
    AiProviderKey.GOOGLE_API,
    AiProviderKey.CLAUDE_CODE_CLI,
    AiProviderKey.COPILOT_CLI,
  ])('returns correct provider for key %s', (key) => {
    const provider = factory.getProvider(key);
    expect(provider.key).toBe(key);
  });

  it('throws for an unknown key', () => {
    expect(() =>
      factory.getProvider('unknown-key' as AiProviderKey),
    ).toThrow('No provider registered');
  });

  it('getAllProviders returns all 5 providers', () => {
    const all = factory.getAllProviders();
    expect(all).toHaveLength(5);
  });
});
