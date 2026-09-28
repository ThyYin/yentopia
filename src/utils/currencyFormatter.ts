export function formatMoney(amount: number, currency: string): string {
  const code = currency.trim().toUpperCase();
  const digits = fractionDigits(code);
  const formatted = new Intl.NumberFormat('en', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
  return `${formatted} ${code}`;
}

export function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) {
    return '0';
  }

  return new Intl.NumberFormat('en', {
    maximumSignificantDigits: 6,
  }).format(rate);
}

export function formatExchangeRate(from: string, to: string, rate: number): string {
  return `1 ${from} = ${formatRate(rate)} ${to}`;
}

export function formatRateDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return isoDate;
  }

  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function currencyDisplayName(code: string, knownName?: string): string {
  const trimmed = knownName?.trim();
  if (trimmed) return trimmed;

  try {
    const display = new Intl.DisplayNames(['en'], { type: 'currency' }).of(code);
    if (display && display.toUpperCase() !== code.toUpperCase()) {
      return display;
    }
  } catch {
    return code;
  }

  return code;
}

function fractionDigits(currency: string): number {
  try {
    const digits = new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits;
    return typeof digits === 'number' ? digits : 2;
  } catch {
    return 2;
  }
}
