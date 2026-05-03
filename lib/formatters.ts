type NumberFormatOptions = {
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
};

type CurrencyFormatOptions = {
  fractionDigits?: number;
};

const INR_SYMBOL = "₹";

export function formatCurrency(
  value: number | null | undefined,
  { fractionDigits = 2 }: CurrencyFormatOptions = {}
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${INR_SYMBOL}${formatIndianNumber(value, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits
  })}`;
}

export function formatWholeCurrency(value: number | null | undefined): string {
  return formatCurrency(value, {
    fractionDigits: 0
  });
}

export function formatCrores(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${formatCurrency(value)} Cr`;
}

export function formatLakhs(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${formatCurrency(value)} Lakh`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${formatIndianNumber(value, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })}%`;
}

export function formatDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return formatIndianNumber(value, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return formatIndianNumber(value, {
    maximumFractionDigits: 0
  });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatIndianNumber(value: number, options: NumberFormatOptions = {}): string {
  return new Intl.NumberFormat("en-IN", options).format(value);
}
