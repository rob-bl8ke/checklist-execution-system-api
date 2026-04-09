import { GoogleProvider } from './google.provider';
import { mockRequest } from './test-helpers';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('GoogleProvider', () => {
  let provider: GoogleProvider;

  beforeEach(() => {
    process.env.GOOGLE_API_KEY = 'test-google-key';
    provider = new GoogleProvider();
    mockFetch.mockReset();
  });

  afterEach(() => {
    delete process.env.GOOGLE_API_KEY;
  });

  describe('capabilities', () => {
    it('reports available: true when API key is set', () => {
      expect(provider.capabilities.available).toBe(true);
      expect(provider.capabilities.transport).toBe('api');
    });

    it('reports available: false when API key is missing', () => {
      delete process.env.GOOGLE_API_KEY;
      const p = new GoogleProvider();
      expect(p.capabilities.available).toBe(false);
      expect(p.capabilities.unavailableReason).toContain('GOOGLE_API_KEY');
    });
  });

  describe('generate', () => {
    it('returns advice-only for ADVICE_ONLY request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: { parts: [{ text: 'Gemini advice.' }] },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
        }),
      });

      const result = await provider.generate(
        mockRequest({ expectedOutput: 'ADVICE_ONLY' }),
      );
      expect(result.assistantMessage).toBe('Gemini advice.');
      expect(result.proposal).toBeUndefined();
    });

    it('parses structured body_proposal response', async () => {
      const structured = JSON.stringify({
        mode: 'body_proposal',
        assistantMessage: 'Gemini improved it!',
        proposal: {
          proposedBody: '# Gemini body',
          rationale: 'More concise.',
          confidence: 0.8,
        },
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: structured }] }, finishReason: 'STOP' },
          ],
        }),
      });

      const result = await provider.generate(mockRequest());
      expect(result.proposal!.proposedBody).toBe('# Gemini body');
    });

    it('sends responseMimeType for structured requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{}' }] } }],
        }),
      });

      await provider.generate(mockRequest());
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.generationConfig.responseMimeType).toBe('application/json');
    });

    it('omits responseMimeType for ADVICE_ONLY', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'advice' }] } }],
        }),
      });

      await provider.generate(mockRequest({ expectedOutput: 'ADVICE_ONLY' }));
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.generationConfig.responseMimeType).toBeUndefined();
    });

    it('includes API key in URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'ok' }] } }],
        }),
      });

      await provider.generate(mockRequest());
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('key=test-google-key');
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });
      await expect(provider.generate(mockRequest())).rejects.toThrow(
        'Google API error: 403',
      );
    });
  });
});
