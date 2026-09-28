import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_AMOUNT } from '../src/config.js';
import {
  AMOUNT_TOO_LARGE_MESSAGE,
  INVALID_AMOUNT_MESSAGE,
} from '../src/utils/messages.js';
import { isCurrencyCode, normalizeCurrency, validateAmount } from '../src/utils/validation.js';

test('normalises currency codes without changing their letters', () => {
  assert.equal(normalizeCurrency(' myr '), 'MYR');
  assert.equal(normalizeCurrency('usd'), 'USD');
  assert.equal(normalizeCurrency('jPy'), 'JPY');
});

test('accepts only three-letter currency codes', () => {
  assert.equal(isCurrencyCode('MYR'), true);
  assert.equal(isCurrencyCode('XYZ'), true);
  assert.equal(isCurrencyCode('123'), false);
  assert.equal(isCurrencyCode('US'), false);
  assert.equal(isCurrencyCode('MYR1'), false);
  assert.equal(isCurrencyCode('US$'), false);
});

test('rejects amounts that are not usable money values', () => {
  for (const value of [0, -1, -100, Number.NaN, Number.POSITIVE_INFINITY, 'abc', '', 'Infinity']) {
    const result = validateAmount(value);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.message, INVALID_AMOUNT_MESSAGE);
  }
});

test('rejects amounts above the maximum', () => {
  const result = validateAmount(MAX_AMOUNT + 1);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.message, AMOUNT_TOO_LARGE_MESSAGE);
});

test('accepts positive finite amounts', () => {
  const result = validateAmount('100.50');
  assert.deepEqual(result, { ok: true, amount: 100.5 });
  assert.deepEqual(validateAmount(MAX_AMOUNT), { ok: true, amount: MAX_AMOUNT });
});
