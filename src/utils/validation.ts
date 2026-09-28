import { MAX_AMOUNT } from '../config.js';
import { AMOUNT_TOO_LARGE_MESSAGE, INVALID_AMOUNT_MESSAGE } from './messages.js';

const CURRENCY_CODE = /^[A-Z]{3}$/;

export function normalizeCurrency(input: string): string {
  return input.trim().toUpperCase();
}

export function isCurrencyCode(code: string): boolean {
  return CURRENCY_CODE.test(code);
}

export type AmountResult =
  | { ok: true; amount: number }
  | { ok: false; message: string };

export function validateAmount(input: unknown): AmountResult {
  const amount = typeof input === 'number' ? input : typeof input === 'string' ? Number(input.trim()) : Number.NaN;

  if (!Number.isFinite(amount)) {
    return { ok: false, message: INVALID_AMOUNT_MESSAGE };
  }

  if (amount <= 0) {
    return { ok: false, message: INVALID_AMOUNT_MESSAGE };
  }

  if (amount > MAX_AMOUNT) {
    return { ok: false, message: AMOUNT_TOO_LARGE_MESSAGE };
  }

  return { ok: true, amount };
}
