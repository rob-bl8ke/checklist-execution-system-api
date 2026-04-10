import { PromptRunnerService } from './prompt-runner.service';
import { ProviderFactory } from '../providers/provider.factory';
import { ProviderCapabilitiesService } from './provider-capabilities.service';
import { PromptTemplateService } from './prompt-template.service';
import { AiProviderKey } from '../enums/ai-provider-key.enum';
import { AiTargetType } from '../enums/ai-target-type.enum';
import { AiGenerateRequest } from '../interfaces/ai-generate-request.interface';
import { AiProviderCapabilities } from '../interfaces/ai-provider.interface';

function makeRequest(
  overrides: Partial<AiGenerateRequest> = {},
): AiGenerateRequest {
  return {
    targetType: AiTargetType.NOTE,
    targetId: 1,
    title: 'Test',
    body: 'body',
    tags: [],
    variablePrefix: null,
    variableSuffix: null,
    history: [],
    userMessage: 'Help.',
    presetActionKey: null,
    expectedOutput: 'BODY_PROPOSAL_OR_ADVICE',
    ...overrides,
  };
}

const availableCapabilities: AiProviderCapabilities = {
  available: true,
  transport: 'api',
  supportsChat: true,
  supportsPresetActions: true,
  supportsStructuredProposal: true,
  supportsStreaming: false,
};

const unavailableCapabilities: AiProviderCapabilities = {
  ...availableCapabilities,
  available: false,
  unavailableReason: 'No API key',
};

describe('PromptRunnerService', () => {
  let service: PromptRunnerService;
  let mockFactory: jest.Mocked<ProviderFactory>;
  let mockCapabilities: jest.Mocked<ProviderCapabilitiesService>;
  let promptTemplate: PromptTemplateService;

  beforeEach(() => {
    mockFactory = {
      getProvider: jest.fn(),
      getAllProviders: jest.fn(),
    } as unknown as jest.Mocked<ProviderFactory>;

    mockCapabilities = {
      getCapabilities: jest.fn(),
      getAllCapabilities: jest.fn(),
      defaultProviderKey: null,
      defaultModel: null,
    } as unknown as jest.Mocked<ProviderCapabilitiesService>;

    promptTemplate = new PromptTemplateService();
    service = new PromptRunnerService(mockFactory, mockCapabilities, promptTemplate);
  });

  it('dispatches to the requested provider and returns its result', async () => {
    const mockProvider = {
      key: AiProviderKey.ANTHROPIC_API,
      capabilities: availableCapabilities,
      generate: jest.fn().mockResolvedValue({
        assistantMessage: 'Looks good!',
        rawMetadata: {},
      }),
    };

    mockCapabilities.getCapabilities.mockReturnValue(availableCapabilities);
    mockFactory.getProvider.mockReturnValue(mockProvider);

    const result = await service.run(
      makeRequest(),
      AiProviderKey.ANTHROPIC_API,
    );

    expect(mockFactory.getProvider).toHaveBeenCalledWith(
      AiProviderKey.ANTHROPIC_API,
    );
    expect(result.assistantMessage).toBe('Looks good!');
  });

  it('injects assembled systemPrompt into the dispatch request', async () => {
    const mockProvider = {
      key: AiProviderKey.ANTHROPIC_API,
      capabilities: availableCapabilities,
      generate: jest.fn().mockResolvedValue({
        assistantMessage: 'ok',
        rawMetadata: {},
      }),
    };

    mockCapabilities.getCapabilities.mockReturnValue(availableCapabilities);
    mockFactory.getProvider.mockReturnValue(mockProvider);

    await service.run(makeRequest(), AiProviderKey.ANTHROPIC_API);

    const dispatchedRequest = mockProvider.generate.mock
      .calls[0][0] as AiGenerateRequest;
    expect(dispatchedRequest.systemPrompt).toBeTruthy();
    expect(dispatchedRequest.systemPrompt).toContain('Notes Assistant');
  });

  it('falls back to Anthropic when no provider key provided and no default set', async () => {
    const mockProvider = {
      key: AiProviderKey.ANTHROPIC_API,
      capabilities: availableCapabilities,
      generate: jest.fn().mockResolvedValue({ assistantMessage: 'ok', rawMetadata: {} }),
    };

    mockCapabilities.getCapabilities.mockReturnValue(availableCapabilities);
    mockCapabilities.defaultProviderKey = null;
    mockFactory.getProvider.mockReturnValue(mockProvider);

    await service.run(makeRequest());

    expect(mockFactory.getProvider).toHaveBeenCalledWith(
      AiProviderKey.ANTHROPIC_API,
    );
  });

  it('uses the configured default provider when no override is given', async () => {
    const mockProvider = {
      key: AiProviderKey.OPENAI_API,
      capabilities: availableCapabilities,
      generate: jest.fn().mockResolvedValue({ assistantMessage: 'ok', rawMetadata: {} }),
    };

    mockCapabilities.getCapabilities.mockReturnValue(availableCapabilities);
    mockCapabilities.defaultProviderKey = AiProviderKey.OPENAI_API;
    mockFactory.getProvider.mockReturnValue(mockProvider);

    await service.run(makeRequest());

    expect(mockFactory.getProvider).toHaveBeenCalledWith(
      AiProviderKey.OPENAI_API,
    );
  });

  it('throws when the provider is not available', async () => {
    mockCapabilities.getCapabilities.mockReturnValue(unavailableCapabilities);

    await expect(
      service.run(makeRequest(), AiProviderKey.ANTHROPIC_API),
    ).rejects.toThrow('is not available');
  });

  it('passes custom system prompt through to prompt assembly', async () => {
    const mockProvider = {
      key: AiProviderKey.ANTHROPIC_API,
      capabilities: availableCapabilities,
      generate: jest.fn().mockResolvedValue({ assistantMessage: 'ok', rawMetadata: {} }),
    };

    mockCapabilities.getCapabilities.mockReturnValue(availableCapabilities);
    mockFactory.getProvider.mockReturnValue(mockProvider);

    await service.run(
      makeRequest(),
      AiProviderKey.ANTHROPIC_API,
      'Super custom prompt',
    );

    const dispatched = mockProvider.generate.mock.calls[0][0] as AiGenerateRequest;
    expect(dispatched.systemPrompt).toContain('Super custom prompt');
  });
});
