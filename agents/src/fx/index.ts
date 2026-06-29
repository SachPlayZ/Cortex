import {
  assertSupportedCurrency,
  convertMinorUnitsToUsdCents,
  hashJson,
  parseDecimalToMinorUnits,
  parseFxRateToScaled,
  type FxQuote
} from "@cortex/shared";

export type FxProviderResponse = {
  rateDecimal: string;
  source: "frankfurter" | "exchange-rate-api" | "manual-demo";
  sourceTimestamp: string;
  raw: Record<string, string>;
};

export interface FxRateProvider {
  getUsdRate(currency: string): Promise<FxProviderResponse>;
}

export class ManualFxRateProvider implements FxRateProvider {
  constructor(private readonly rates: Record<string, string>) {}

  async getUsdRate(currency: string): Promise<FxProviderResponse> {
    const normalized = currency.toUpperCase();
    const rateDecimal = this.rates[normalized];
    if (!rateDecimal) {
      throw new Error(`Missing manual FX rate for ${normalized}`);
    }
    return {
      rateDecimal,
      source: "manual-demo",
      sourceTimestamp: new Date("2026-06-28T00:00:00.000Z").toISOString(),
      raw: { [normalized]: rateDecimal }
    };
  }
}

export class FrankfurterFxRateProvider implements FxRateProvider {
  async getUsdRate(currency: string): Promise<FxProviderResponse> {
    const normalized = assertSupportedCurrency(currency);
    if (normalized === "USD") {
      return {
        rateDecimal: "1",
        source: "frankfurter",
        sourceTimestamp: new Date().toISOString(),
        raw: { USD: "1" }
      };
    }

    const response = await fetch(`https://api.frankfurter.dev/v2/rates?base=${normalized}&quotes=USD`);
    if (!response.ok) {
      throw new Error(`Frankfurter FX failed: ${response.status}`);
    }
    const body = (await response.json()) as { rate?: number; quote?: string; date?: string };
    if (typeof body.rate !== "number" || !Number.isFinite(body.rate) || body.rate <= 0) {
      throw new Error("Frankfurter FX response missing positive rate");
    }
    if (body.quote !== "USD") {
      throw new Error("Frankfurter FX response missing USD quote");
    }
    return {
      rateDecimal: body.rate.toString(),
      source: "frankfurter",
      sourceTimestamp: body.date ? `${body.date}T00:00:00.000Z` : new Date().toISOString(),
      raw: { rate: body.rate.toString(), date: body.date ?? "" }
    };
  }
}

export class FxNormalizer {
  private readonly cache = new Map<string, { expiresAtMs: number; response: FxProviderResponse }>();

  constructor(
    private readonly provider: FxRateProvider,
    private readonly ttlMs = 10 * 60 * 1000,
    private readonly clock = () => Date.now()
  ) {}

  async normalize(input: {
    original_currency: string;
    original_amount_decimal: string;
    invoice_date: string;
  }): Promise<FxQuote> {
    const currency = assertSupportedCurrency(input.original_currency);
    const originalAmountMinor = parseDecimalToMinorUnits(input.original_amount_decimal, currency);
    const providerResponse =
      currency === "USD"
        ? {
            rateDecimal: "1",
            source: "manual-demo" as const,
            sourceTimestamp: new Date(this.clock()).toISOString(),
            raw: { USD: "1" }
          }
        : await this.getCachedRate(currency);
    const fxRateScaled = parseFxRateToScaled(providerResponse.rateDecimal);
    const usdAmountCents = convertMinorUnitsToUsdCents({
      originalAmountMinor,
      originalCurrency: currency,
      fxRateScaled
    });
    const fetchedAt = new Date(this.clock()).toISOString();

    return {
      base_currency: currency,
      quote_currency: "USD",
      rate_decimal: providerResponse.rateDecimal,
      source: providerResponse.source,
      source_timestamp: providerResponse.sourceTimestamp,
      fetched_at: fetchedAt,
      original_amount_minor: originalAmountMinor.toString(),
      usd_amount_cents: usdAmountCents.toString(),
      fx_response_hash: hashJson(providerResponse.raw)
    };
  }

  private async getCachedRate(currency: string): Promise<FxProviderResponse> {
    const cached = this.cache.get(currency);
    const now = this.clock();
    if (cached && cached.expiresAtMs > now) {
      return cached.response;
    }
    const response = await this.provider.getUsdRate(currency);
    this.cache.set(currency, { expiresAtMs: now + this.ttlMs, response });
    return response;
  }
}
