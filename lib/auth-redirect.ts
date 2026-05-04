export const AUTH_CALLBACK_PATH = "/auth/callback";

type SearchParams = Record<string, string | string[] | undefined> | URLSearchParams;

export function getAuthCallbackUrl(currentOrigin?: string) {
  return buildUrl(
    AUTH_CALLBACK_PATH,
    getSiteOrigin(currentOrigin ?? getBrowserOrigin())
  ).toString();
}

export function getRootAuthCallbackPath(searchParams: SearchParams) {
  const code = readSearchParam(searchParams, "code");

  if (!code) {
    return null;
  }

  const callbackSearchParams = new URLSearchParams({
    code
  });

  return `${AUTH_CALLBACK_PATH}?${callbackSearchParams.toString()}`;
}

export function getAuthHomeUrl(requestUrl: string) {
  return buildUrl("/", getSiteOrigin(new URL(requestUrl).origin));
}

function getSiteOrigin(fallbackOrigin?: string) {
  const normalizedFallbackOrigin = normalizeOrigin(fallbackOrigin);
  const configuredOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);

  if (configuredOrigin && shouldUseConfiguredOrigin(configuredOrigin, normalizedFallbackOrigin)) {
    return configuredOrigin;
  }

  if (normalizedFallbackOrigin) {
    return normalizedFallbackOrigin;
  }

  return "http://localhost:3000";
}

function buildUrl(pathname: string, origin: string) {
  const base = origin.endsWith("/") ? origin : `${origin}/`;
  return new URL(pathname, base);
}

function normalizeOrigin(value: string | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    return new URL(trimmedValue).origin;
  } catch {
    return null;
  }
}

function readSearchParam(searchParams: SearchParams, key: string) {
  if (searchParams instanceof URLSearchParams) {
    return searchParams.get(key);
  }

  const value = searchParams[key];

  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function getBrowserOrigin() {
  return typeof window === "undefined" ? undefined : window.location.origin;
}

function shouldUseConfiguredOrigin(configuredOrigin: string, fallbackOrigin: string | null) {
  if (!fallbackOrigin) {
    return true;
  }

  return !isLocalOrigin(configuredOrigin) || isLocalOrigin(fallbackOrigin);
}

function isLocalOrigin(origin: string) {
  try {
    const hostname = new URL(origin).hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}
