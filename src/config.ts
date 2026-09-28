export const FRANKFURTER_BASE_URL = 'https://api.frankfurter.dev';
export const RATE_SOURCE_NAME = 'Frankfurter';

export const REQUEST_TIMEOUT_MS = 10_000;
export const HTTP_RETRIES = 1;

export const RATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const CURRENCY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const EMPTY_CURRENCY_RETRY_MS = 60_000;
export const RATE_CACHE_LIMIT = 1_000;

export const MAX_AMOUNT = 1_000_000_000_000;
export const USER_COOLDOWN_MS = 1_000;
export const AUTOCOMPLETE_CHOICES = 25;
export const CURRENCIES_PAGE_SIZE = 20;
export const COMMAND_PREFIX = 'cy!';

export interface DiscordConfig {
  token: string;
  clientId: string;
}

export function loadDiscordConfig(env: NodeJS.ProcessEnv = process.env): DiscordConfig {
  const token = env.DISCORD_TOKEN?.trim() ?? '';
  const clientId = env.DISCORD_CLIENT_ID?.trim() ?? '';

  const missing: string[] = [];
  if (!token) missing.push('DISCORD_TOKEN');
  if (!clientId) missing.push('DISCORD_CLIENT_ID');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable: ${missing.join(', ')}`);
  }

  return { token, clientId };
}
