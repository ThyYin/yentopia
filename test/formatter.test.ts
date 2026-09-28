import assert from 'node:assert/strict';
import test from 'node:test';
import {
  currencyDisplayName,
  formatExchangeRate,
  formatMoney,
  formatRate,
  formatRateDate,
} from '../src/utils/currencyFormatter.js';

test('formats money with the right number of decimal places', () => {
  assert.equal(formatMoney(100, 'usd'), '100.00 USD');
  assert.equal(formatMoney(1234.56, 'USD'), '1,234.56 USD');
  assert.equal(formatMoney(10000, 'JPY'), '10,000 JPY');
  assert.equal(formatMoney(10.5, 'BHD'), '10.500 BHD');
});

test('falls back when a currency code is not known to Intl', () => {
  assert.equal(formatMoney(12.3, 'XYZ'), '12.30 XYZ');
});

test('formats exchange rates without hiding small values', () => {
  assert.equal(formatRate(0.2345), '0.2345');
  assert.equal(formatRate(1), '1');
  assert.equal(formatRate(158.16), '158.16');
  assert.equal(formatExchangeRate('MYR', 'USD', 0.2345), '1 MYR = 0.2345 USD');
});

test('formats rate dates for people, not as raw timestamps', () => {
  assert.equal(formatRateDate('2026-09-28'), '28 September 2026');
  assert.equal(formatRateDate('not-a-date'), 'not-a-date');
});

test('uses a known currency name and falls back to the code', () => {
  assert.equal(currencyDisplayName('MYR', 'Malaysian Ringgit'), 'Malaysian Ringgit');
  assert.equal(currencyDisplayName('USD'), 'US Dollar');
  assert.equal(currencyDisplayName('XYZ'), 'XYZ');
});
