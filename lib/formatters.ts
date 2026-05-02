export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);
}

export function formatCrores(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0
  }).format(value)} Cr`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0
  }).format(value);
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
