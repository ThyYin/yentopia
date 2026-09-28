export interface Currency {
  code: string;
  name: string;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  date: string | null;
}

export interface CachedRate {
  rate: number;
  date: string;
  fetchedAt: number;
}

export interface ConversionResult {
  from: string;
  to: string;
  amount: number;
  converted: number;
  rate: number;
  date: string | null;
  sameCurrency: boolean;
}

export interface ExchangeRateProvider {
  getCurrencies(): Promise<Currency[]>;
  getRate(from: string, to: string): Promise<ExchangeRate>;
}
