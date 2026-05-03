import { describe, expect, it } from "vitest";

import {
  formatCrores,
  formatCurrency,
  formatDecimal,
  formatLakhs,
  formatNumber,
  formatPercent,
  formatWholeCurrency
} from "@/lib/formatters";

describe("formatters", () => {
  it("formats Indian rupee values with the requested precision", () => {
    expect(formatCurrency(1234.5)).toBe("₹1,234.50");
    expect(formatWholeCurrency(500)).toBe("₹500");
    expect(formatCurrency(0)).toBe("₹0.00");
  });

  it("formats crores, lakhs, percentages, decimals, and whole numbers consistently", () => {
    expect(formatCrores(15000)).toBe("₹15,000.00 Cr");
    expect(formatLakhs(5)).toBe("₹5.00 Lakh");
    expect(formatPercent(16.4)).toBe("16.40%");
    expect(formatDecimal(1)).toBe("1.00");
    expect(formatNumber(1250000)).toBe("12,50,000");
  });

  it("uses a dash for missing or invalid values", () => {
    expect(formatCurrency(null)).toBe("-");
    expect(formatCrores(undefined)).toBe("-");
    expect(formatLakhs(Number.NaN)).toBe("-");
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe("-");
    expect(formatDecimal(Number.NEGATIVE_INFINITY)).toBe("-");
  });
});
