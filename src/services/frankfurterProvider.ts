import { FRANKFURTER_BASE_URL, HTTP_RETRIES, REQUEST_TIMEOUT_MS } from '../config.js';
import type { Currency, ExchangeRate, ExchangeRateProvider } from '../types/currency.js';
import { ProviderError } from '../utils/errors.js';
import { requestJson } from '../utils/http.js';
import { isCurrencyCode, normalizeCurrency } from '../utils/validation.js';

export interface FrankfurterProviderOptions {
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class FrankfurterProvider implements ExchangeRateProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly signal: AbortSignal | undefined;
  private readonly fetchImpl: typeof fetch | undefined;

  constructor(options: FrankfurterProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? FRANKFURTER_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.retries = options.retries ?? HTTP_RETRIES;
    this.signal = options.signal;
    this.fetchImpl = options.fetchImpl;
  }

  async getCurrencies(): Promise<Currency[]> {
    const payload = await requestJson(`${this.baseUrl}/v2/currencies`, {
      timeoutMs: this.timeoutMs,
      retries: this.retries,
      signal: this.signal,
      fetchImpl: this.fetchImpl,
    });
    return parseCurrencies(payload);
  }

  async getRate(from: string, to: string): Promise<ExchangeRate> {
    const base = normalizeCurrency(from);
    const quote = normalizeCurrency(to);
    if (!isCurrencyCode(base) || !isCurrencyCode(quote)) {
      throw new ProviderError('UNSUPPORTED');
    }

    const payload = await requestJson(
      `${this.baseUrl}/v2/rate/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`,
      {
        timeoutMs: this.timeoutMs,
        retries: this.retries,
        signal: this.signal,
        fetchImpl: this.fetchImpl,
      },
    );

    return parseRate(payload, base, quote);
  }
}

function parseCurrencies(payload: unknown): Currency[] {
  if (!Array.isArray(payload)) {
    throw new ProviderError('INVALID_RESPONSE');
  }

  const currencies = new Map<string, Currency>();
  for (const item of payload) {
    if (!isRecord(item)) continue;
    if (typeof item.iso_code !== 'string' || typeof item.name !== 'string') continue;
    const code = normalizeCurrency(item.iso_code);
    const name = item.name.trim();
    if (!isCurrencyCode(code) || name.length === 0 || currencies.has(code)) continue;
    currencies.set(code, { code, name });
  }

  if (currencies.size === 0) {
    throw new ProviderError('INVALID_RESPONSE');
  }

  return [...currencies.values()].sort((left, right) => left.code.localeCompare(right.code));
}

function parseRate(payload: unknown, from: string, to: string): ExchangeRate {
  if (!isRecord(payload)) {
    throw new ProviderError('INVALID_RESPONSE');
  }

  const date = payload.date;
  const base = payload.base;
  const quote = payload.quote;
  const rate = payload.rate;

  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ProviderError('INVALID_RESPONSE');
  }
  if (typeof base !== 'string' || normalizeCurrency(base) !== from) {
    throw new ProviderError('INVALID_RESPONSE');
  }
  if (typeof quote !== 'string' || normalizeCurrency(quote) !== to) {
    throw new ProviderError('INVALID_RESPONSE');
  }
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new ProviderError('INVALID_RESPONSE');
  }

  return { from, to, rate, date };
}
