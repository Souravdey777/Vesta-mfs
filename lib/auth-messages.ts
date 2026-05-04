type AuthErrorLike = {
  message?: string;
} | null;

export function getMagicLinkErrorMessage(error: AuthErrorLike) {
  const message = error?.message?.trim();

  if (!message) {
    return "Could not send the sign-in link. Check Supabase Auth logs for details.";
  }

  return `Could not send the sign-in link: ${message}`;
}

export function getOAuthSignInErrorMessage(providerName: string, error: AuthErrorLike) {
  const message = error?.message?.trim();

  if (!message) {
    return `Could not start ${providerName} sign-in. Check Supabase Auth logs for details.`;
  }

  return `Could not start ${providerName} sign-in: ${message}`;
}
