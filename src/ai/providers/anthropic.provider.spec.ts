import { AnthropicProvider } from './anthropic.provider';
import { mockRequest } from './test-helpers';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    provider = new AnthropicProvider();
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('capabilities', () => {
    it('reports available: true when API key is set', () => {
      expect(provider.capabilities.available).toBe(true);
      expect(provider.capabilities.transport).toBe('api');
      expect(provider.capabilities.supportsStructuredProposal).toBe(true);
    });

    it('reports available: false when API key is missing', () => {
      delete process.env.ANTHROPIC_API_KEY;
      const p = new AnthropicProvider();
      expect(p.capabilities.available).toBe(false);
      expect(p.capabilities.unavailableReason).toContain('ANTHROPIC_API_KEY');
    });
  });

  describe('generate', () => {
    it('returns an advice-only result when model returns plain text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Plain advice from Anthropic.' }],
          model: 'claude-3-5-haiku',
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      });

      const result = await provider.generate(
        mockRequest({ expectedOutput: 'ADVICE_ONLY' }),
      );

      expect(result.assistantMessage).toBe('Plain advice from Anthropic.');
      expect(result.proposal).toBeUndefined();
      expect(result.rawMetadata.model).toBe('claude-3-5-haiku');
    });

    it('parses a structured body_proposal response', async () => {
      const structured = JSON.stringify({
        mode: 'body_proposal',
        assistantMessage: 'Here is an improved note.',
        proposal: {
          proposedBody: '# Better Note\nImproved content.',
          rationale: 'More readable.',
          confidence: 0.85,
        },
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: structured }],
          model: 'claude-3-5-haiku',
          stop_reason: 'end_turn',
        }),
      });

      const result = await provider.generate(mockRequest());

      expect(result.assistantMessage).toBe('Here is an improved note.');
      expect(result.proposal).toBeDefined();
      expect(result.proposal!.proposedBody).toBe('# Better Note\nImproved content.');
      expect(result.proposal!.confidence).toBe(0.85);
    });

    it('degrades to advice-only when JSON is unparseable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'not json at all' }],
          model: 'claude-3-5-haiku',
          stop_reason: 'end_turn',
        }),
      });

      const result = await provider.generate(mockRequest());
      expect(result.assistantMessage).toBe('not json at all');
      expect(result.proposal).toBeUndefined();
    });

    it('throws on non-ok API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(provider.generate(mockRequest())).rejects.toThrow(
        'Anthropic API error: 401',
      );
    });

    it('sends messages array and system prompt correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'ok' }],
        }),
      });

      await provider.generate(
        mockRequest({
          history: [{ role: 'user', content: 'previous message' }],
          systemPrompt: 'Custom system prompt',
        }),
      );

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.system).toBe('Custom system prompt');
      expect(body.messages[0].content).toBe('previous message');
      expect(init.headers).toMatchObject({ 'x-api-key': 'test-api-key' });
    });
  });
});
