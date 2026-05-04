export type ChatGuardrailReason = "advice" | "fund_name" | "sentence_count";

export type ChatGuardrailResult = {
  changed: boolean;
  reason: ChatGuardrailReason | null;
  text: string;
};

export type ChatGuardrailOptions = {
  allowedFundNames?: readonly string[];
};

const SAFE_SCREENING_FALLBACK =
  "I updated the screen using structured filters. Check the results table for fund names and metrics.";
const SAFE_ADVICE_FALLBACK =
  "I can screen funds, but I cannot give investment or tax advice. Use the results table as your source of truth.";
const SAFE_FUND_NAME_FALLBACK =
  "I kept the response data-first and avoided naming funds from memory. Check the results table for specific fund names and metrics.";
const FOLLOW_UP_SENTENCE = "Check the results table for fund names and metrics.";

const ADVICE_PATTERNS = [
  /\b(?:you should|you must|you need to|i recommend|my recommendation|i suggest you|best option|best fund|guaranteed|risk-free|assured returns)\b/i,
  /\b(?:buy|sell|invest in|redeem|switch to|choose|pick)\b[\s\S]{0,80}\b(?:fund|scheme|elss|sip|nfo)\b/i,
  /\b(?:claim|deduct|deduction|section 80c|80c|tax liability|tax saving strategy|tax advice)\b/i
];
const FUND_NAME_PATTERN =
  /\b[A-Z][A-Za-z0-9&'.-]*(?:\s+(?:[A-Z][A-Za-z0-9&'.-]*|[0-9]+)){0,7}\s+(?:Fund|Growth|Dividend|Plan)\b/g;
const GENERIC_FUND_PHRASES = new Set([
  "large cap fund",
  "mid cap fund",
  "small cap fund",
  "flexi cap fund",
  "index fund",
  "debt fund",
  "hybrid fund",
  "elss fund",
  "direct plan",
  "regular plan"
]);

export function guardAssistantText(
  text: string,
  options: ChatGuardrailOptions = {}
): ChatGuardrailResult {
  const normalizedText = normalizeWhitespace(text);
  const allowedFundNames = normalizeAllowedFundNames(options.allowedFundNames);

  if (!normalizedText) {
    return {
      changed: false,
      reason: null,
      text: ""
    };
  }

  if (containsAdvice(normalizedText)) {
    return {
      changed: true,
      reason: "advice",
      text: SAFE_ADVICE_FALLBACK
    };
  }

  if (containsGeneratedFundName(normalizedText, allowedFundNames)) {
    return {
      changed: true,
      reason: "fund_name",
      text: SAFE_FUND_NAME_FALLBACK
    };
  }

  const sentences = splitSentences(normalizedText);

  if (sentences.length > 4) {
    return {
      changed: true,
      reason: "sentence_count",
      text: sentences.slice(0, 4).join(" ")
    };
  }

  if (sentences.length < 2) {
    return {
      changed: true,
      reason: "sentence_count",
      text: `${ensureTerminalPunctuation(normalizedText)} ${FOLLOW_UP_SENTENCE}`
    };
  }

  return {
    changed: false,
    reason: null,
    text: normalizedText
  };
}

export function guardAssistantStreamingText(
  text: string,
  options: ChatGuardrailOptions = {}
): ChatGuardrailResult {
  const normalizedText = normalizeWhitespace(text);
  const allowedFundNames = normalizeAllowedFundNames(options.allowedFundNames);

  if (!normalizedText) {
    return {
      changed: false,
      reason: null,
      text: ""
    };
  }

  if (containsAdvice(normalizedText)) {
    return {
      changed: true,
      reason: "advice",
      text: SAFE_ADVICE_FALLBACK
    };
  }

  if (containsGeneratedFundName(normalizedText, allowedFundNames)) {
    return {
      changed: true,
      reason: "fund_name",
      text: SAFE_FUND_NAME_FALLBACK
    };
  }

  const sentences = splitSentences(normalizedText);

  if (sentences.length > 4) {
    return {
      changed: true,
      reason: "sentence_count",
      text: sentences.slice(0, 4).join(" ")
    };
  }

  return {
    changed: false,
    reason: null,
    text: normalizedText
  };
}

export function guardAssistantStructuredText(
  text: string,
  options: ChatGuardrailOptions = {}
): ChatGuardrailResult {
  const structuredText = normalizeStructuredWhitespace(text);
  const scanText = normalizeWhitespace(structuredText);
  const allowedFundNames = normalizeAllowedFundNames(options.allowedFundNames);

  if (!scanText) {
    return {
      changed: false,
      reason: null,
      text: ""
    };
  }

  if (containsAdvice(scanText)) {
    return {
      changed: true,
      reason: "advice",
      text: SAFE_ADVICE_FALLBACK
    };
  }

  if (containsGeneratedFundName(scanText, allowedFundNames)) {
    return {
      changed: true,
      reason: "fund_name",
      text: SAFE_FUND_NAME_FALLBACK
    };
  }

  return {
    changed: structuredText !== text.trim(),
    reason: null,
    text: structuredText
  };
}

function containsAdvice(text: string): boolean {
  return ADVICE_PATTERNS.some((pattern) => pattern.test(text));
}

function containsGeneratedFundName(text: string, allowedFundNames: ReadonlySet<string>): boolean {
  FUND_NAME_PATTERN.lastIndex = 0;
  let match = FUND_NAME_PATTERN.exec(text);

  while (match) {
    const normalizedMatch = normalizeWhitespace(match[0]).toLowerCase();

    if (!GENERIC_FUND_PHRASES.has(normalizedMatch) && !allowedFundNames.has(normalizedMatch)) {
      return true;
    }

    match = FUND_NAME_PATTERN.exec(text);
  }

  return false;
}

function normalizeAllowedFundNames(names: readonly string[] | undefined): ReadonlySet<string> {
  return new Set((names ?? []).map((name) => normalizeWhitespace(name).toLowerCase()));
}

function splitSentences(text: string): string[] {
  return (
    text
      .match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? []
  );
}

function ensureTerminalPunctuation(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeStructuredWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
