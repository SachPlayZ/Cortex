import { Decimal } from "decimal.js";
import { getMinorUnit, isSupportedCurrency, type SupportedCurrency } from "../constants/currency.js";
import { CortexError } from "../constants/errors.js";

const DECIMAL_AMOUNT_RE = /^(0|[1-9]\d*)(\.\d+)?$/;
export const DEFAULT_FX_RATE_SCALE = 1_000_000_000n;
export const BPS_DENOMINATOR = 10_000n;

export type FundingTerms = {
  discountBps: number;
  advanceRateBps: number;
  advanceAmountUsdCents: bigint;
  repaymentAmountUsdCents: bigint;
  investorYieldUsdCents: bigint;
};

export function assertSupportedCurrency(currency: string): SupportedCurrency {
  const normalized = currency.toUpperCase();

  if (!isSupportedCurrency(normalized)) {
    throw new CortexError("UnsupportedCurrency", `Unsupported currency: ${currency}`);
  }

  return normalized;
}

export function parseDecimalToMinorUnits(amountDecimal: string, currency: string): bigint {
  const normalizedCurrency = assertSupportedCurrency(currency);
  const trimmedAmount = amountDecimal.trim();

  if (!DECIMAL_AMOUNT_RE.test(trimmedAmount)) {
    throw new CortexError("InvalidAmount", `Invalid decimal amount: ${amountDecimal}`);
  }

  const minorUnit = getMinorUnit(normalizedCurrency);
  const fractional = trimmedAmount.split(".")[1] ?? "";

  if (fractional.length > minorUnit) {
    throw new CortexError("InvalidAmount", `${normalizedCurrency} supports ${minorUnit} decimal places`);
  }

  const decimal = new Decimal(trimmedAmount);

  if (!decimal.isFinite() || decimal.lte(0)) {
    throw new CortexError("InvalidAmount", "Amount must be greater than zero");
  }

  const scaled = decimal.mul(new Decimal(10).pow(minorUnit));

  if (!scaled.isInteger()) {
    throw new CortexError("InvalidAmount", "Amount cannot be represented in minor units");
  }

  return BigInt(scaled.toFixed(0));
}

export function formatMinorUnits(amountMinor: bigint, currency: string): string {
  if (amountMinor < 0n) {
    throw new CortexError("InvalidAmount", "Amount cannot be negative");
  }

  const normalizedCurrency = assertSupportedCurrency(currency);
  const minorUnit = getMinorUnit(normalizedCurrency);
  const divisor = 10n ** BigInt(minorUnit);
  const whole = amountMinor / divisor;
  const fractional = amountMinor % divisor;

  if (minorUnit === 0) {
    return whole.toString();
  }

  return `${whole.toString()}.${fractional.toString().padStart(minorUnit, "0")}`;
}

export function parseFxRateToScaled(rateDecimal: string, scale = DEFAULT_FX_RATE_SCALE): bigint {
  const trimmedRate = rateDecimal.trim();

  if (!DECIMAL_AMOUNT_RE.test(trimmedRate)) {
    throw new CortexError("InvalidAmount", `Invalid FX rate: ${rateDecimal}`);
  }

  const scaled = new Decimal(trimmedRate).mul(scale.toString());

  if (!scaled.isFinite() || scaled.lte(0)) {
    throw new CortexError("InvalidAmount", "FX rate must be greater than zero");
  }

  return BigInt(scaled.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0));
}

export function convertMinorUnitsToUsdCents(params: {
  originalAmountMinor: bigint;
  originalCurrency: string;
  fxRateScaled: bigint;
  fxRateScale?: bigint;
}): bigint {
  const { originalAmountMinor, originalCurrency, fxRateScaled } = params;
  const fxRateScale = params.fxRateScale ?? DEFAULT_FX_RATE_SCALE;
  const normalizedCurrency = assertSupportedCurrency(originalCurrency);

  if (originalAmountMinor <= 0n) {
    throw new CortexError("InvalidAmount", "Original amount must be greater than zero");
  }

  if (fxRateScaled <= 0n || fxRateScale <= 0n) {
    throw new CortexError("InvalidAmount", "FX rate and scale must be greater than zero");
  }

  const currencyScale = 10n ** BigInt(getMinorUnit(normalizedCurrency));
  const numerator = originalAmountMinor * fxRateScaled * 100n;
  const denominator = currencyScale * fxRateScale;

  return divideRoundHalfUp(numerator, denominator);
}

export function calculateFundingTerms(invoiceAmountUsdCents: bigint, discountBps: number): FundingTerms {
  if (invoiceAmountUsdCents <= 0n) {
    throw new CortexError("InvalidAmount", "Invoice amount must be greater than zero");
  }

  if (!Number.isInteger(discountBps) || discountBps < 0 || discountBps > 3000) {
    throw new CortexError("InvalidBpsMath", "Discount bps must be an integer from 0 to 3000");
  }

  const discountBpsBigint = BigInt(discountBps);
  const advanceRateBpsBigint = BPS_DENOMINATOR - discountBpsBigint;
  const advanceAmountUsdCents = (invoiceAmountUsdCents * advanceRateBpsBigint) / BPS_DENOMINATOR;
  const repaymentAmountUsdCents = invoiceAmountUsdCents;

  return {
    discountBps,
    advanceRateBps: Number(advanceRateBpsBigint),
    advanceAmountUsdCents,
    repaymentAmountUsdCents,
    investorYieldUsdCents: repaymentAmountUsdCents - advanceAmountUsdCents
  };
}

export function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new CortexError("InvalidAmount", "Denominator must be greater than zero");
  }

  const quotient = numerator / denominator;
  const remainder = numerator % denominator;

  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}
