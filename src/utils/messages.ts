export const INVALID_AMOUNT_MESSAGE = [
  'invalid amount bro',
  '',
  'pls enter a number GREATER THAN 0',
  '',
  'like dis:',
  '/convert from:MYR to:USD amount:100',
  'cy!convert MYR USD 100',
].join('\n');

export const AMOUNT_TOO_LARGE_MESSAGE = [
  'invalid amount bro',
  '',
  'pls enter a number ONLY up to 1,000,000,000,000',
  '',
  'like dis:',
  '/convert from:MYR to:USD amount:100',
  'cy!convert MYR USD 100',
].join('\n');

export const UNKNOWN_CURRENCY_MESSAGE = [
  "couldn't find that currency bro",
  '',
  'pls use a valid ISO 4217 currency code, e.g. USD, JPY, SGD, etc.',
].join('\n');

export const TIMEOUT_MESSAGE = [
  'damn, timed out',
  '',
  'pls try again cuh, mb 🙏',
].join('\n');

export const GENERIC_RATE_MESSAGE = [
  "uhh couldn't retrieve the rate rn",
  '',
  'pls try again cuh, mb 🙏',
].join('\n');

export const COOLDOWN_MESSAGE = 'damnnn u goin too fast cuh, chill CHILL!';

export const CURRENCY_LIST_UNAVAILABLE_MESSAGE = [
  "uhh couldn't load the currency list rn",
  '',
  'pls try again cuh, mb 🙏',
].join('\n');

export const UNKNOWN_COMMAND_MESSAGE = "Nah, shit ain't in my diary. View commands by typing `/help` or `cy!help`";

export const CONVERT_USAGE_MESSAGE = [
  'i need ze SOURCE, TARGET, and AMOUNT currency sigh 🤦‍♂️',
  '',
  'like dis:',
  '/convert from:MYR to:USD amount:100',
  'cy!convert MYR USD 100',
].join('\n');

export const RATE_USAGE_MESSAGE = [
  'i need TWO (2) currency codes sigh 🤦‍♂️',
  '',
  'like dis:',
  '/rate from:SGD to:JPY',
  'cy!rate SGD JPY',
].join('\n');

export const CURRENCY_PAGE_OWNER_MESSAGE =
  'blud tryna flip someone else\'s page, tf is u doin 😭';

export function currencySearchMissMessage(query: string): string {
  const shown = query.trim().slice(0, 80);
  return [
    `couldn't find a currency matching **"${shown}"** cuh`,
  ].join('\n');
}
