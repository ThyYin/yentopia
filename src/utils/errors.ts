export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

export type ProviderErrorCode =
  | 'TIMEOUT'
  | 'NETWORK'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'UNSUPPORTED'
  | 'INVALID_RESPONSE';

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode) {
    super(code);
    this.name = 'ProviderError';
    this.code = code;
  }
}
