import { describe, expect, it } from "vitest";
import {
  calculateFundingTerms,
  convertMinorUnitsToUsdCents,
  parseDecimalToMinorUnits,
  parseFxRateToScaled
} from "../src/index.js";

describe("money helpers", () => {
  it("converts decimal money strings into minor units", () => {
    expect(parseDecimalToMinorUnits("83000.00", "INR")).toBe(8_300_000n);
    expect(parseDecimalToMinorUnits("1200", "JPY")).toBe(1200n);
    expect(parseDecimalToMinorUnits("12.345", "KWD")).toBe(12_345n);
  });

  it("rejects invalid currency and invalid amounts", () => {
    expect(() => parseDecimalToMinorUnits("10.00", "DOGE")).toThrow("Unsupported currency");
    expect(() => parseDecimalToMinorUnits("0", "USD")).toThrow("greater than zero");
    expect(() => parseDecimalToMinorUnits("-1", "USD")).toThrow("Invalid decimal amount");
    expect(() => parseDecimalToMinorUnits("1.001", "USD")).toThrow("supports 2 decimal places");
  });

  it("converts original currency into USD cents with fixed-point rate", () => {
    const amountMinor = parseDecimalToMinorUnits("83000.00", "INR");
    const rateScaled = parseFxRateToScaled("0.012");

    expect(convertMinorUnitsToUsdCents({ originalAmountMinor: amountMinor, originalCurrency: "INR", fxRateScaled: rateScaled })).toBe(
      99_600n
    );
  });

  it("rounds FX conversion half-up", () => {
    const rateScaled = parseFxRateToScaled("0.012345");

    expect(convertMinorUnitsToUsdCents({ originalAmountMinor: 1n, originalCurrency: "INR", fxRateScaled: rateScaled })).toBe(0n);
    expect(convertMinorUnitsToUsdCents({ originalAmountMinor: 50n, originalCurrency: "INR", fxRateScaled: rateScaled })).toBe(1n);
  });

  it("calculates advance and repayment with bps math", () => {
    const terms = calculateFundingTerms(100_000n, 350);

    expect(terms.discountBps).toBe(350);
    expect(terms.advanceRateBps).toBe(9650);
    expect(terms.advanceAmountUsdCents).toBe(96_500n);
    expect(terms.repaymentAmountUsdCents).toBe(100_000n);
    expect(terms.investorYieldUsdCents).toBe(3_500n);
  });
});
