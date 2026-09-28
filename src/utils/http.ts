import { REQUEST_TIMEOUT_MS } from '../config.js';
import { ProviderError, type ProviderErrorCode } from './errors.js';
import { logger } from './logger.js';

export interface RequestJsonOptions {
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ProviderError('NETWORK'));
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new ProviderError('NETWORK'));
    };

    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function statusToError(status: number): ProviderErrorCode {
  if (status === 400 || status === 404 || status === 422) return 'UNSUPPORTED';
  if (status === 429) return 'RATE_LIMITED';
  return 'UNAVAILABLE';
}

function isRetryable(error: ProviderError): boolean {
  return error.code === 'UNAVAILABLE' || error.code === 'RATE_LIMITED' || error.code === 'NETWORK';
}

async function fetchOnce(url: string, timeoutMs: number, parentSignal: AbortSignal | undefined, fetchImpl: typeof fetch): Promise<unknown> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = parentSignal ? AbortSignal.any([timeoutSignal, parentSignal]) : timeoutSignal;

  try {
    const response = await fetchImpl(url, {
      signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'Yentopia (discord currency bot)',
      },
    });

    const text = await response.text();
    let body: unknown = null;
    if (text.length > 0) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        if (response.ok) {
          throw new ProviderError('INVALID_RESPONSE');
        }
      }
    }

    if (!response.ok) {
      const apiMessage =
        isRecord(body) && typeof body.message === 'string' ? body.message.slice(0, 200) : '';
      logger.error(
        `Frankfurter request failed (${response.status}) ${url}${apiMessage ? `: ${apiMessage}` : ''}`,
      );
      throw new ProviderError(statusToError(response.status));
    }

    if (text.length === 0) {
      throw new ProviderError('INVALID_RESPONSE');
    }

    return body;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (parentSignal?.aborted) throw new ProviderError('NETWORK');
    if (timeoutSignal.aborted) throw new ProviderError('TIMEOUT');
    throw new ProviderError('NETWORK');
  }
}

export async function requestJson(url: string, options: RequestJsonOptions = {}): Promise<unknown> {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const retries = options.retries ?? 0;
  const fetchImpl = options.fetchImpl ?? fetch;
  const attempts = retries + 1;
  let lastError: ProviderError = new ProviderError('UNAVAILABLE');

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchOnce(url, timeoutMs, options.signal, fetchImpl);
    } catch (error) {
      lastError = error instanceof ProviderError ? error : new ProviderError('NETWORK');
      const canRetry = attempt < attempts && isRetryable(lastError) && !options.signal?.aborted;
      if (!canRetry) throw lastError;
      await delay(250 * attempt, options.signal);
    }
  }

  throw lastError;
}
