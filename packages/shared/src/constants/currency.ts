export const CurrencyMinorUnits = {
  BHD: 3,
  EUR: 2,
  GBP: 2,
  INR: 2,
  JPY: 0,
  KWD: 3,
  USD: 2
} as const;

export type SupportedCurrency = keyof typeof CurrencyMinorUnits;

export function isSupportedCurrency(currency: string): currency is SupportedCurrency {
  return Object.prototype.hasOwnProperty.call(CurrencyMinorUnits, currency);
}

export function getMinorUnit(currency: string): number {
  if (!isSupportedCurrency(currency)) {
    throw new Error(`Unsupported currency: ${currency}`);
  }

  return CurrencyMinorUnits[currency];
}
