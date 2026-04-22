import { Injectable } from '@nestjs/common';

export interface ApiRequestOptions {
  url: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
  /** Timeout in milliseconds (default: 30 000). */
  timeoutMs?: number;
}

/**
 * Thin wrapper around the built-in `fetch` API that adds:
 *  - a configurable `AbortController`-based timeout
 *  - a standard `Content-Type: application/json` header
 *  - JSON serialization / deserialization
 *
 * All AI provider adapters consume this service so transport concerns
 * are centralized and easy to mock in tests.
 */
@Injectable()
export class ApiClientFactoryService {
  /**
   * Performs an HTTP POST with a JSON body and returns the parsed JSON response.
   * Throws on non-2xx status codes.
   */
  async post<T = unknown>(options: ApiRequestOptions): Promise<T> {
    const { url, body, headers, timeoutMs = 30_000 } = options;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      const isAbort =
        err instanceof Error && err.name === 'AbortError';
      throw new Error(
        isAbort
          ? `Request to ${url} timed out after ${timeoutMs}ms`
          : `Network error calling ${url}: ${String(err)}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `HTTP ${response.status} ${response.statusText} from ${url}: ${text}`,
      );
    }

    return response.json() as Promise<T>;
  }
}
