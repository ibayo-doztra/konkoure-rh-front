// Preloaded into the API process: e-mails land in a local outbox and nothing can
// leave the machine, whatever the API tries to call.
import { appendFileSync } from "node:fs";

const outbox = process.env.E2E_OUTBOX;
if (!outbox) throw new Error("E2E_OUTBOX is required");

const realFetch = globalThis.fetch;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);

  if (url.hostname === "api.resend.com" && url.pathname === "/emails") {
    const { to, subject, html } = await request.json();
    appendFileSync(outbox, `${JSON.stringify({ to, subject, html })}\n`);
    return Response.json({ id: crypto.randomUUID() });
  }
  if (LOCAL_HOSTS.has(url.hostname)) return realFetch(request);
  throw new Error(`Outbound call blocked during e2e tests: ${url.hostname}`);
};
