// isConnectionError: true when a request failed because the device couldn't reach the server (so the sale should wait and
// try again), false when the server answered and refused it (so a person has to decide). Errors are matched by shape because
// PostgREST errors are plain objects, not Error instances.
const CONNECTION_MESSAGE = /failed to fetch|fetch failed|networkerror|network request failed|network error|load failed|timed? ?out|econn|err_internet|err_network|err_connection|err_name_not_resolved/i;

// RETRY_CODES: the server could not finish yet but the sale may still be fine — expired login token (refreshes on reconnect),
// an unclaimed duplicate race (the retry finds the first copy) and gateway timeouts
const RETRY_CODES = new Set(["PGRST301", "PGRST303", "23505", "57014", "40001", "40P01"]);
const RETRY_MESSAGE = /jwt expired|jwt is expired|invalid jwt|bad gateway|service unavailable|gateway time-?out/i;

export function isConnectionError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (error instanceof TypeError) return true; // what fetch() throws when there is no network
  const { message, code } = (error ?? {}) as { message?: unknown; code?: unknown };
  if (typeof code === "string" && RETRY_CODES.has(code)) return true;
  if (typeof message === "string" && (CONNECTION_MESSAGE.test(message) || RETRY_MESSAGE.test(message))) return true;
  return false;
}

// errorMessage: a short readable reason from any thrown value
export function errorMessage(error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message : "Something went wrong.";
}
