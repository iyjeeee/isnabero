import { translateNow } from "@/i18n";

// inviteErrorMessage: the real reason an Edge Function call failed. supabase-js reports any non-2xx reply as a generic
// "non-2xx status code" error and keeps the function's own JSON message on error.context (the Response).
export async function inviteErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as { error?: unknown };
      if (typeof body.error === "string" && body.error) return body.error;
    } catch {
      // not JSON: fall through to the generic message
    }
  }
  // the request never got a usable reply (function not deployed to this project, wrong project, blocked or offline)
  if ((error as { name?: unknown } | null)?.name === "FunctionsFetchError") return translateNow("employees.add.inviteUnreachable");
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message : "Something went wrong.";
}
