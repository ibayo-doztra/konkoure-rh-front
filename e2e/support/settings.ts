import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");

export const API_PORT = 3334;
export const WEB_PORT = 8092;
export const API_URL = `http://localhost:${API_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const API_DIR = path.resolve(root, process.env.KONKOURE_API_DIR ?? "../konkoure-rh-api");
export const OUTBOX = path.join(root, "e2e", ".outbox", "mails.jsonl");
export const PASSWORD = "Tamarin-Rouge-2026";
