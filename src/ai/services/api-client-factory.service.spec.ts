import { ApiClientFactoryService } from './api-client-factory.service';

describe('ApiClientFactoryService', () => {
  let service: ApiClientFactoryService;
  let mockFetch: jest.Mock;
  const originalFetch = global.fetch;

  beforeEach(() => {
    service = new ApiClientFactoryService();
    mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls fetch with POST method and JSON body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: 'ok' }),
    });

    await service.post({
      url: 'https://api.example.com/v1/test',
      body: { key: 'value' },
      headers: { Authorization: 'Bearer token' },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/v1/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'value' }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        }),
      }),
    );
  });

  it('returns parsed JSON on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: 'response' }] }),
    });

    const result = await service.post({
      url: 'https://api.example.com/v1/chat',
      body: {},
      headers: {},
    });

    expect(result).toEqual({ choices: [{ message: 'response' }] });
  });

  it('throws an error with status info on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('Invalid API key'),
    });

    await expect(
      service.post({ url: 'https://api.example.com', body: {}, headers: {} }),
    ).rejects.toThrow('HTTP 401 Unauthorized');
  });

  it('throws a timeout error when AbortController aborts', async () => {
    mockFetch.mockImplementation(
      () =>
        new Promise((_, reject) => {
          const err = new Error('The operation was aborted.');
          err.name = 'AbortError';
          reject(err);
        }),
    );

    await expect(
      service.post({
        url: 'https://api.example.com',
        body: {},
        headers: {},
        timeoutMs: 1,
      }),
    ).rejects.toThrow('timed out');
  });

  it('throws a network error on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));

    await expect(
      service.post({ url: 'https://api.example.com', body: {}, headers: {} }),
    ).rejects.toThrow('Network error');
  });

  it('includes Content-Type: application/json in all requests', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await service.post({ url: 'https://x.com', body: {}, headers: {} });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
  });
});
