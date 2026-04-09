import { OpenAIProvider } from './openai.provider';
import { mockRequest } from './test-helpers';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    provider = new OpenAIProvider();
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('capabilities', () => {
    it('reports available: true when API key is set', () => {
      expect(provider.capabilities.available).toBe(true);
      expect(provider.capabilities.transport).toBe('api');
    });

    it('reports available: false when API key is missing', () => {
      delete process.env.OPENAI_API_KEY;
      const p = new OpenAIProvider();
      expect(p.capabilities.available).toBe(false);
      expect(p.capabilities.unavailableReason).toContain('OPENAI_API_KEY');
    });
  });

  describe('generate', () => {
    it('returns advice-only when expected output is ADVICE_ONLY', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Good advice.' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
          model: 'gpt-4o-mini',
        }),
      });

      const result = await provider.generate(
        mockRequest({ expectedOutput: 'ADVICE_ONLY' }),
      );
      expect(result.assistantMessage).toBe('Good advice.');
      expect(result.proposal).toBeUndefined();
    });

    it('parses structured body_proposal', async () => {
      const structured = JSON.stringify({
        mode: 'body_proposal',
        assistantMessage: 'Improved!',
        proposal: {
          proposedBody: '# New body',
          rationale: 'Cleaner.',
          confidence: 0.7,
        },
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: structured }, finish_reason: 'stop' }],
          model: 'gpt-4o-mini',
        }),
      });

      const result = await provider.generate(mockRequest());
      expect(result.proposal).toBeDefined();
      expect(result.proposal!.proposedBody).toBe('# New body');
    });

    it('sends JSON mode response_format when structured output requested', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{}' }, finish_reason: 'stop' }],
          model: 'gpt-4o-mini',
        }),
      });

      await provider.generate(mockRequest());

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.response_format).toEqual({ type: 'json_object' });
    });

    it('does not send response_format for ADVICE_ONLY', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'advice' }, finish_reason: 'stop' }],
          model: 'gpt-4o-mini',
        }),
      });

      await provider.generate(mockRequest({ expectedOutput: 'ADVICE_ONLY' }));
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.response_format).toBeUndefined();
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });
      await expect(provider.generate(mockRequest())).rejects.toThrow(
        'OpenAI API error: 429',
      );
    });
  });
});
