import { ProviderError, UserFacingError } from './errors.js';
import {
  GENERIC_RATE_MESSAGE,
  TIMEOUT_MESSAGE,
  UNKNOWN_CURRENCY_MESSAGE,
} from './messages.js';

export function toUserMessage(error: unknown): string {
  if (error instanceof UserFacingError) {
    return error.message;
  }

  if (error instanceof ProviderError) {
    if (error.code === 'TIMEOUT') return TIMEOUT_MESSAGE;
    if (error.code === 'UNSUPPORTED') return UNKNOWN_CURRENCY_MESSAGE;
    return GENERIC_RATE_MESSAGE;
  }

  return GENERIC_RATE_MESSAGE;
}
