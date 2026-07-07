import { z } from "zod";
import { isSupportedCurrency } from "../constants/currency.js";

export const Hex32Schema = z.string().regex(/^0x[a-f0-9]{64}$/);
export const BigIntStringSchema = z.string().regex(/^(0|[1-9]\d*)$/);
export const PositiveBigIntStringSchema = z.string().regex(/^[1-9]\d*$/);
export const IsoCurrencySchema = z
  .string()
  .length(3)
  .transform((value) => value.toUpperCase())
  .refine((value) => isSupportedCurrency(value), "Unsupported currency");
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Invalid calendar date");
export const IsoDateTimeSchema = z.string().datetime();

export const BpsSchema = z.number().int().min(0).max(10_000);
