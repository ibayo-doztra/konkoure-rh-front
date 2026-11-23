import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");

export const API_PORT = 3334;
export const WEB_PORT = 8092;
export const API_URL = `http://localhost:${API_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const API_DIR = path.resolve(root, process.env.KONKOURE_API_DIR ?? "../konkoure-rh-api");
export const OUTBOX = path.join(root, "e2e", ".outbox", "mails.jsonl");
export const PASSWORD = "Tamarin-Rouge-2026";

/** Environment of the API under test, shared by its server and the `node ace` commands. */
export const API_ENV: Record<string, string> = {
  NODE_ENV: "test",
  HOST: "localhost",
  PORT: String(API_PORT),
  APP_URL: API_URL,
  WEB_APP_URL: WEB_URL,
  CORS_ORIGINS: WEB_URL,
  DB_DATABASE: "konkoure_e2e",
  // The API runs under its real database role, so row-level security applies.
  DB_APP_ROLE: "konkoure_app",
  LIMITER_STORE: "memory",
  // The whole suite shares one IP: the production budget (300/min) would
  // throttle it. Accepted by the API outside production only.
  RATE_LIMIT_GLOBAL_IP_PER_MINUTE: "10000",
  // Required by the timeclock module (konkoure-rh-api #12); any value in tests.
  NFC_UID_PEPPER: "e2e-only-pepper",
  LOG_LEVEL: "warn",
  MAIL_MAILER: "resend",
  RESEND_API_KEY: "e2e-fake-key",
};
