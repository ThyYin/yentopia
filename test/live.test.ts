import assert from 'node:assert/strict';
import test from 'node:test';
import { FrankfurterProvider } from '../src/services/frankfurterProvider.js';
import { CurrencyService } from '../src/services/currencyService.js';
import { UserFacingError } from '../src/utils/errors.js';

test('live Frankfurter conversions, case handling, and cache hits', async () => {
  let rateCalls = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/v2/rate/')) rateCalls += 1;
    return fetch(input, init);
  };

  const provider = new FrankfurterProvider({ fetchImpl, timeoutMs: 10_000, retries: 1 });
  const service = new CurrencyService(provider);

  try {
    await service.refreshCurrencies();
    assert.ok(service.getCurrencyList().some((currency) => currency.code === 'MYR'));

    const pairs = [
      ['MYR', 'USD'],
      ['USD', 'MYR'],
      ['SGD', 'JPY'],
      ['JPY', 'SGD'],
      ['EUR', 'GBP'],
    ] as const;

    for (const [from, to] of pairs) {
      const result = await service.convert(from, to, 100);
      assert.equal(result.from, from);
      assert.equal(result.to, to);
      assert.ok(result.converted > 0);
      assert.match(result.date ?? '', /^\d{4}-\d{2}-\d{2}$/);
    }

    const callsAfterPairs = rateCalls;
    await service.convert('myr', 'usd', 50);
    await service.convert('jPy', 'SGD', 10_000);
    assert.equal(rateCalls, callsAfterPairs);

    const same = await service.convert('MYR', 'MYR', 100);
    assert.equal(same.converted, 100);
    assert.equal(same.sameCurrency, true);
    assert.equal(rateCalls, callsAfterPairs);

    for (const code of ['XYZ', 'ABC', '123']) {
      await assert.rejects(service.convert(code, 'USD', 10), UserFacingError);
    }
    assert.equal(rateCalls, callsAfterPairs);

    for (const amount of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await assert.rejects(service.convert('USD', 'MYR', amount), UserFacingError);
    }
    assert.equal(rateCalls, callsAfterPairs);
  } finally {
    service.dispose();
  }
});
