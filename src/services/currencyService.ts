import {
  CURRENCY_CACHE_TTL_MS,
  EMPTY_CURRENCY_RETRY_MS,
  RATE_CACHE_LIMIT,
  RATE_CACHE_TTL_MS,
} from '../config.js';
import type {
  CachedRate,
  ConversionResult,
  Currency,
  ExchangeRate,
  ExchangeRateProvider,
} from '../types/currency.js';
import { ProviderError, UserFacingError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { UNKNOWN_CURRENCY_MESSAGE } from '../utils/messages.js';
import { isCurrencyCode, normalizeCurrency, validateAmount } from '../utils/validation.js';

const BACKGROUND_REFRESH_GAP_MS = 30_000;

const PREFERRED_CODES = [
  'MYR',
  'USD',
  'SGD',
  'JPY',
  'EUR',
  'GBP',
  'AUD',
  'CAD',
  'CHF',
  'CNY',
  'HKD',
  'KRW',
  'THB',
  'IDR',
  'PHP',
];

export interface CurrencyServiceOptions {
  rateTtlMs?: number;
  currencyTtlMs?: number;
  emptyRetryMs?: number;
  clock?: () => number;
}

export class CurrencyService {
  private currencies: Currency[] | null = null;
  private codes: Set<string> | null = null;
  private currenciesFetchedAt = 0;
  private lastCurrencyAttemptAt = 0;
  private currencyLoad: Promise<void> | null = null;
  private readonly rates = new Map<string, CachedRate>();
  private readonly inflight = new Map<string, Promise<ExchangeRate>>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private disposed = false;

  private readonly rateTtlMs: number;
  private readonly currencyTtlMs: number;
  private readonly emptyRetryMs: number;
  private readonly clock: () => number;

  constructor(
    private readonly provider: ExchangeRateProvider,
    options: CurrencyServiceOptions = {},
  ) {
    this.rateTtlMs = options.rateTtlMs ?? RATE_CACHE_TTL_MS;
    this.currencyTtlMs = options.currencyTtlMs ?? CURRENCY_CACHE_TTL_MS;
    this.emptyRetryMs = options.emptyRetryMs ?? EMPTY_CURRENCY_RETRY_MS;
    this.clock = options.clock ?? Date.now;
  }

  async init(): Promise<void> {
    if (this.started) return;
    this.started = true;

    try {
      await this.refreshCurrencies();
    } catch (error) {
      logger.warn('Currency list unavailable. Yentopia will keep starting and retry later.');
      logger.error('Initial currency load failed', error);
    }

    this.scheduleRefresh();
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  hasFreshCurrencies(): boolean {
    return this.currencies !== null && this.clock() - this.currenciesFetchedAt < this.currencyTtlMs;
  }

  getCurrencyList(): Currency[] {
    return this.currencies ? [...this.currencies] : [];
  }

  kickCurrencyRefresh(): void {
    if (this.disposed || this.hasFreshCurrencies() || this.currencyLoad) return;
    if (
      this.lastCurrencyAttemptAt !== 0 &&
      this.clock() - this.lastCurrencyAttemptAt < BACKGROUND_REFRESH_GAP_MS
    ) {
      return;
    }

    void this.refreshCurrencies().catch((error: unknown) => {
      logger.error('Background currency refresh failed', error);
    });
  }

  async refreshCurrencies(): Promise<void> {
    if (this.currencyLoad) return this.currencyLoad;

    this.lastCurrencyAttemptAt = this.clock();
    this.currencyLoad = this.loadCurrencies().finally(() => {
      this.currencyLoad = null;
    });

    return this.currencyLoad;
  }

  normalizeSupported(input: string): string {
    const code = normalizeCurrency(input);
    if (!isCurrencyCode(code) || (this.codes !== null && !this.codes.has(code))) {
      throw new UserFacingError(UNKNOWN_CURRENCY_MESSAGE);
    }
    return code;
  }

  searchCurrencies(query: string, limit: number): Currency[] {
    const list = this.currencies ?? [];
    const needle = query.trim().toLowerCase();

    return list
      .map((currency) => ({ currency, score: scoreCurrency(currency, needle) }))
      .filter((entry) => entry.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score || left.currency.code.localeCompare(right.currency.code),
      )
      .slice(0, limit)
      .map((entry) => entry.currency);
  }

  async getRate(from: string, to: string): Promise<ExchangeRate> {
    const base = this.normalizeSupported(from);
    const quote = this.normalizeSupported(to);

    if (base === quote) {
      return { from: base, to: quote, rate: 1, date: null };
    }

    const key = `${base}:${quote}`;
    const cached = this.rates.get(key);
    if (cached && this.clock() - cached.fetchedAt < this.rateTtlMs) {
      logger.info(`Cached exchange rate: ${base} → ${quote}`);
      return { from: base, to: quote, rate: cached.rate, date: cached.date };
    }

    if (cached) {
      this.rates.delete(key);
    }

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const request = this.fetchAndCache(base, quote, key);
    this.inflight.set(key, request);
    try {
      return await request;
    } finally {
      this.inflight.delete(key);
    }
  }

  async convert(from: string, to: string, amount: number): Promise<ConversionResult> {
    const amountCheck = validateAmount(amount);
    if (!amountCheck.ok) {
      throw new UserFacingError(amountCheck.message);
    }

    const rate = await this.getRate(from, to);
    return {
      from: rate.from,
      to: rate.to,
      amount: amountCheck.amount,
      converted: amountCheck.amount * rate.rate,
      rate: rate.rate,
      date: rate.date,
      sameCurrency: rate.from === rate.to,
    };
  }

  private async fetchAndCache(from: string, to: string, key: string): Promise<ExchangeRate> {
    logger.info(`Fetching exchange rate: ${from} → ${to}`);
    const rate = await this.provider.getRate(from, to);
    if (rate.date === null || !Number.isFinite(rate.rate) || rate.rate <= 0) {
      throw new ProviderError('INVALID_RESPONSE');
    }

    this.rememberRate(key, {
      rate: rate.rate,
      date: rate.date,
      fetchedAt: this.clock(),
    });

    return {
      from,
      to,
      rate: rate.rate,
      date: rate.date,
    };
  }

  private rememberRate(key: string, value: CachedRate): void {
    this.rates.set(key, value);
    if (this.rates.size <= RATE_CACHE_LIMIT) return;

    let oldestKey: string | null = null;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [rateKey, cached] of this.rates) {
      if (cached.fetchedAt < oldestAt) {
        oldestAt = cached.fetchedAt;
        oldestKey = rateKey;
      }
    }
    if (oldestKey) this.rates.delete(oldestKey);
  }

  private async loadCurrencies(): Promise<void> {
    const currencies = await this.provider.getCurrencies();
    this.currencies = currencies;
    this.codes = new Set(currencies.map((currency) => currency.code));
    this.currenciesFetchedAt = this.clock();
    logger.info(`Currency cache loaded: ${currencies.length} currencies`);
  }

  private scheduleRefresh(): void {
    if (this.disposed) return;
    const delay = this.currencies === null ? this.emptyRetryMs : this.currencyTtlMs;
    this.timer = setTimeout(() => {
      void this.refreshCurrencies()
        .catch((error: unknown) => {
          logger.error('Scheduled currency refresh failed', error);
        })
        .finally(() => {
          this.scheduleRefresh();
        });
    }, delay);
    this.timer.unref();
  }
}

function scoreCurrency(currency: Currency, query: string): number {
  if (!query) {
    const preferredIndex = PREFERRED_CODES.indexOf(currency.code);
    return preferredIndex === -1 ? 1 : 1_000 - preferredIndex;
  }

  const code = currency.code.toLowerCase();
  const name = currency.name.toLowerCase();

  if (code === query) return 1_000;
  if (code.startsWith(query)) return 800;
  if (query.length < 3) return 0;
  if (name.startsWith(query)) return 600;
  if (name.includes(query)) return 400;
  return 0;
}
