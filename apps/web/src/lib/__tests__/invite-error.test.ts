import { describe, expect, it } from "vitest";
import { inviteErrorMessage } from "../invite-error";

describe("inviteErrorMessage", () => {
  it("prefers the function's own message", async () => {
    const error = { message: "Edge Function returned a non-2xx status code", context: new Response(JSON.stringify({ error: "Someone with that email already has an account." }), { status: 409 }) };
    expect(await inviteErrorMessage(error)).toBe("Someone with that email already has an account.");
  });
  it("falls back to the error message, then a default", async () => {
    expect(await inviteErrorMessage({ message: "Failed to fetch" })).toBe("Failed to fetch");
    expect(await inviteErrorMessage({ message: "x", context: new Response("not json", { status: 500 }) })).toBe("x");
    expect(await inviteErrorMessage(null)).toBe("Something went wrong.");
  });
});
