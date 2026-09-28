import assert from 'node:assert/strict';
import test from 'node:test';
import { CurrencyService } from '../src/services/currencyService.js';
import type { Currency, ExchangeRate, ExchangeRateProvider } from '../src/types/currency.js';
import { ProviderError, UserFacingError } from '../src/utils/errors.js';
import { INVALID_AMOUNT_MESSAGE } from '../src/utils/messages.js';

class FakeProvider implements ExchangeRateProvider {
  rateCalls = 0;
  currencyCalls = 0;
  currencies: Currency[] = [
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'MYR', name: 'Malaysian Ringgit' },
    { code: 'SGD', name: 'Singapore Dollar' },
    { code: 'USD', name: 'US Dollar' },
  ];
  rate: ExchangeRate = { from: 'MYR', to: 'USD', rate: 0.2345, date: '2026-09-28' };
  rateError: ProviderError | null = null;
  currencyError: ProviderError | null = null;
  rateDelay: Promise<void> | null = null;

  async getCurrencies(): Promise<Currency[]> {
    this.currencyCalls += 1;
    if (this.currencyError) throw this.currencyError;
    return this.currencies;
  }

  async getRate(from: string, to: string): Promise<ExchangeRate> {
    this.rateCalls += 1;
    if (this.rateDelay) await this.rateDelay;
    if (this.rateError) throw this.rateError;
    return { ...this.rate, from, to };
  }
}

async function loadedService(provider = new FakeProvider(), now = { value: 10_000 }): Promise<{
  provider: FakeProvider;
  service: CurrencyService;
  now: { value: number };
}> {
  const service = new CurrencyService(provider, {
    clock: () => now.value,
    rateTtlMs: 1_000,
    currencyTtlMs: 5_000,
    emptyRetryMs: 50,
  });
  await service.refreshCurrencies();
  return { provider, service, now };
}

test('converts with the provider rate and skips the API for the same currency', async () => {
  const { provider, service } = await loadedService();
  const converted = await service.convert('myr', 'USD', 100);
  assert.equal(converted.from, 'MYR');
  assert.equal(converted.to, 'USD');
  assert.equal(converted.converted, 23.45);
  assert.equal(converted.date, '2026-09-28');

  const same = await service.convert('USD', 'usd', 25);
  assert.equal(same.converted, 25);
  assert.equal(same.sameCurrency, true);
  assert.equal(same.date, null);
  assert.equal(provider.rateCalls, 1);
});

test('uses the cache for a repeated pair and refetches after the TTL', async () => {
  const { provider, service, now } = await loadedService();
  await service.getRate('SGD', 'JPY');
  await service.getRate('sgd', 'jpy');
  assert.equal(provider.rateCalls, 1);

  await service.getRate('JPY', 'SGD');
  assert.equal(provider.rateCalls, 2);

  now.value += 1_001;
  await service.getRate('SGD', 'JPY');
  assert.equal(provider.rateCalls, 3);
});

test('does not cache an invalid rate', async () => {
  const provider = new FakeProvider();
  provider.rate = { from: 'MYR', to: 'USD', rate: 0.2, date: null };
  const { service } = await loadedService(provider);

  await assert.rejects(service.getRate('MYR', 'USD'), (error: unknown) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.code, 'INVALID_RESPONSE');
    return true;
  });

  provider.rate = { from: 'MYR', to: 'USD', rate: 0.2, date: '2026-09-28' };
  const rate = await service.getRate('MYR', 'USD');
  assert.equal(rate.rate, 0.2);
  assert.equal(provider.rateCalls, 2);
});

test('rejects unknown currencies before calling the provider', async () => {
  const { provider, service } = await loadedService();
  for (const code of ['XYZ', 'ABC', '123']) {
    await assert.rejects(service.getRate(code, 'USD'), UserFacingError);
  }
  assert.equal(provider.rateCalls, 0);
});

test('rejects invalid amounts before calling the provider', async () => {
  const { provider, service } = await loadedService();
  for (const amount of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    await assert.rejects(service.convert('MYR', 'USD', amount), (error: unknown) => {
      assert.ok(error instanceof UserFacingError);
      assert.equal(error.message, INVALID_AMOUNT_MESSAGE);
      return true;
    });
  }
  assert.equal(provider.rateCalls, 0);
});

test('shares one in-flight request for the same pair', async () => {
  const provider = new FakeProvider();
  let release: () => void = () => {};
  provider.rateDelay = new Promise((resolve) => {
    release = resolve;
  });
  const { service } = await loadedService(provider);

  const first = service.getRate('EUR', 'GBP');
  const second = service.getRate('EUR', 'GBP');
  release();
  const [left, right] = await Promise.all([first, second]);
  assert.equal(left.rate, right.rate);
  assert.equal(provider.rateCalls, 1);
});

test('searches codes and names without treating short text as a name search', async () => {
  const { service } = await loadedService();
  assert.equal(service.searchCurrencies('', 3).map((currency) => currency.code).join(','), 'MYR,USD,SGD');
  assert.deepEqual(
    service.searchCurrencies('ring', 5).map((currency) => currency.code),
    ['MYR'],
  );
  assert.deepEqual(
    service.searchCurrencies('jPy', 5).map((currency) => currency.code),
    ['JPY'],
  );
  assert.deepEqual(
    service.searchCurrencies('us', 10).map((currency) => currency.code),
    ['USD'],
  );
});

test('does not retry a failed currency load on every autocomplete keystroke', async () => {
  const provider = new FakeProvider();
  provider.currencyError = new ProviderError('UNAVAILABLE');
  const service = new CurrencyService(provider, { clock: () => 1_000, emptyRetryMs: 60_000 });

  service.kickCurrencyRefresh();
  await new Promise((resolve) => setTimeout(resolve, 20));
  const callsAfterFailure = provider.currencyCalls;
  service.kickCurrencyRefresh();
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(callsAfterFailure, 1);
  assert.equal(provider.currencyCalls, 1);
  service.dispose();
});

test('keeps starting when the currency list cannot be loaded', async () => {
  const provider = new FakeProvider();
  provider.currencyError = new ProviderError('UNAVAILABLE');
  const service = new CurrencyService(provider, { emptyRetryMs: 60_000 });
  await service.init();
  assert.equal(service.getCurrencyList().length, 0);
  const rate = await service.getRate('MYR', 'USD');
  assert.equal(rate.from, 'MYR');
  service.dispose();
});
