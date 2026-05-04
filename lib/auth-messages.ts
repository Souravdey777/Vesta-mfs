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
