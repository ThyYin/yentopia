import assert from 'node:assert/strict';
import test from 'node:test';
import { FrankfurterProvider } from '../src/services/frankfurterProvider.js';
import { ProviderError } from '../src/utils/errors.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const sampleRate = {
  date: '2026-09-28',
  base: 'USD',
  quote: 'JPY',
  rate: 158.16,
};

test('parses a Frankfurter rate and currency list', async () => {
  const seen: string[] = [];
  const provider = new FrankfurterProvider({
    retries: 0,
    fetchImpl: async (input) => {
      const url = String(input);
      seen.push(url);
      if (url.endsWith('/v2/currencies')) {
        return jsonResponse([
          { iso_code: 'usd', name: 'US Dollar', symbol: '$' },
          { iso_code: 'jpy', name: 'Japanese Yen', symbol: '¥' },
          { iso_code: 'NO', name: 'Too short' },
          { iso_code: 'USD', name: 'Duplicate' },
        ]);
      }
      return jsonResponse(sampleRate);
    },
  });

  const currencies = await provider.getCurrencies();
  assert.deepEqual(currencies, [
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'USD', name: 'US Dollar' },
  ]);

  const rate = await provider.getRate('usd', 'jpy');
  assert.deepEqual(rate, { from: 'USD', to: 'JPY', rate: 158.16, date: '2026-09-28' });
  assert.ok(seen.some((url) => url.endsWith('/v2/rate/USD/JPY')));
});

test('retries a server error once and then succeeds', async () => {
  let calls = 0;
  const provider = new FrankfurterProvider({
    retries: 1,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({ status: 500, message: 'down' }, 500);
      return jsonResponse(sampleRate);
    },
  });

  const rate = await provider.getRate('USD', 'JPY');
  assert.equal(rate.rate, 158.16);
  assert.equal(calls, 2);
});

test('does not retry an unsupported currency', async () => {
  let calls = 0;
  const provider = new FrankfurterProvider({
    retries: 1,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ status: 422, message: 'invalid currency: ABC' }, 422);
    },
  });

  await assert.rejects(provider.getRate('ABC', 'USD'), (error: unknown) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.code, 'UNSUPPORTED');
    return true;
  });
  assert.equal(calls, 1);
});

test('maps HTTP 429 to a rate-limit error after retrying', async () => {
  let calls = 0;
  const provider = new FrankfurterProvider({
    retries: 1,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ status: 429, message: 'slow down' }, 429);
    },
  });

  await assert.rejects(provider.getRate('USD', 'JPY'), (error: unknown) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.code, 'RATE_LIMITED');
    return true;
  });
  assert.equal(calls, 2);
});

test('rejects invalid JSON and a missing rate without caching them', async () => {
  const invalidJson = new FrankfurterProvider({
    retries: 1,
    fetchImpl: async () => new Response('not-json', { status: 200 }),
  });
  await assert.rejects(invalidJson.getRate('USD', 'JPY'), (error: unknown) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.code, 'INVALID_RESPONSE');
    return true;
  });

  const missingRate = new FrankfurterProvider({
    retries: 1,
    fetchImpl: async () =>
      jsonResponse({ date: '2026-09-28', base: 'USD', quote: 'JPY' }),
  });
  await assert.rejects(missingRate.getRate('USD', 'JPY'), (error: unknown) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.code, 'INVALID_RESPONSE');
    return true;
  });
});

test('times out instead of waiting forever', async () => {
  const provider = new FrankfurterProvider({
    timeoutMs: 30,
    retries: 1,
    fetchImpl: (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      }),
  });

  await assert.rejects(provider.getRate('USD', 'JPY'), (error: unknown) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.code, 'TIMEOUT');
    return true;
  });
});

test('retries a dropped network connection', async () => {
  let calls = 0;
  const provider = new FrankfurterProvider({
    retries: 1,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('fetch failed');
      return jsonResponse(sampleRate);
    },
  });

  const rate = await provider.getRate('USD', 'JPY');
  assert.equal(rate.rate, 158.16);
  assert.equal(calls, 2);
});

test('maps HTTP 400, 404, 502, and 503 without exposing the API body', async () => {
  for (const status of [400, 404, 502, 503]) {
    const provider = new FrankfurterProvider({
      retries: 0,
      fetchImpl: async () => jsonResponse({ status, message: 'internal detail' }, status),
    });
    const expected = status === 400 || status === 404 ? 'UNSUPPORTED' : 'UNAVAILABLE';
    await assert.rejects(provider.getRate('USD', 'JPY'), (error: unknown) => {
      assert.ok(error instanceof ProviderError);
      assert.equal(error.code, expected);
      assert.equal(error.message.includes('internal detail'), false);
      return true;
    });
  }
});

test('refuses to put an unsafe currency code in the request URL', async () => {
  let calls = 0;
  const provider = new FrankfurterProvider({
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse(sampleRate);
    },
  });

  await assert.rejects(provider.getRate('../USD', 'JPY'), (error: unknown) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.code, 'UNSUPPORTED');
    return true;
  });
  assert.equal(calls, 0);
});
