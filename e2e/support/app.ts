import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { API_DIR, API_ENV, API_URL, OUTBOX, PASSWORD } from "./settings";

/** The dashboard adds its own query string (`?period=month`). */
export const APP_URL = /\/app(\?.*)?$/;

let counter = 0;

/** Each test owns its accounts, so tests never depend on one another. */
export function uniqueEmail(prefix: string) {
  counter += 1;
  return `${prefix}${Date.now()}${counter}@example.com`;
}

/** Server-rendered forms ignore React handlers until hydration has finished. */
export async function open(page: Page, url: string) {
  await page.goto(url);
  await page.waitForFunction(() =>
    Object.keys(document.body).some((key) => key.startsWith("__reactFiber")),
  );
}

interface OutboxMail {
  to: string[];
  subject: string;
  html: string;
}

function mailLinks(email: string, route: string) {
  if (!existsSync(OUTBOX)) return [];
  const pattern = new RegExp(`https?://[^"'\\s<]+(${route}\\?token=[^"'\\s<&]+)`);
  return readFileSync(OUTBOX, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as OutboxMail)
    .filter((mail) => mail.to.some((to) => to.includes(email)))
    .flatMap((mail) => mail.html.match(pattern)?.[1] ?? []);
}

/** Waits for the n-th e-mail holding a link to `route` and returns that link. */
export async function mailLink(email: string, route: string, count = 1) {
  await expect
    .poll(() => mailLinks(email, route).length, { message: `${route} e-mail for ${email}` })
    .toBeGreaterThanOrEqual(count);
  return mailLinks(email, route)[count - 1];
}

export async function fillSignup(page: Page, email: string, password = PASSWORD) {
  await page.locator("#full_name").fill("Aïssata Camara");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#confirm").fill(password);
  await page.locator("#accept-terms").click();
}

export async function signUp(page: Page, email: string) {
  await open(page, "/signup");
  await fillSignup(page, email);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("button", { name: "J'ai confirmé mon e-mail" })).toBeVisible();
}

export async function signIn(page: Page, email: string, password = PASSWORD, url = "/login") {
  await open(page, url);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

async function apiData<T>(response: Awaited<ReturnType<APIRequestContext["post"]>>) {
  expect(response.ok(), `${response.url()} → ${response.status()}`).toBeTruthy();
  return ((await response.json()) as { data: T }).data;
}

export interface Owner {
  email: string;
  accessToken: string;
  organizationId: string;
  organizationName: string;
}

/** Account with a verified e-mail and an organization, created through the API only. */
export async function createOwner(request: APIRequestContext): Promise<Owner> {
  const email = uniqueEmail("owner");
  const { accessToken } = await apiData<{ accessToken: string }>(
    await request.post(`${API_URL}/api/v1/auth/register`, {
      data: {
        email,
        password: PASSWORD,
        password_confirmation: PASSWORD,
        fullName: "Mamadou Diallo",
        acceptTerms: true,
      },
    }),
  );
  const link = await mailLink(email, "/verify-email");
  const token = new URL(link, API_URL).searchParams.get("token");
  const verified = await request.post(`${API_URL}/api/v1/auth/verify-email`, { data: { token } });
  expect(verified.status()).toBe(204);

  const organizationName = `Société ${Date.now()}`;
  const organization = await apiData<{ id: string }>(
    await request.post(`${API_URL}/api/v1/organizations`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: organizationName },
    }),
  );
  return { email, accessToken, organizationId: organization.id, organizationName };
}

export async function invite(request: APIRequestContext, owner: Owner, email: string) {
  await apiData(
    await request.post(`${API_URL}/api/v1/org/invitations`, {
      headers: {
        Authorization: `Bearer ${owner.accessToken}`,
        "X-Organization-Id": owner.organizationId,
        "Idempotency-Key": crypto.randomUUID(),
      },
      data: { email, role: "manager" },
    }),
  );
  return mailLink(email, "/invitation");
}

/**
 * Puts an organization on a plan through the API's own command, which also
 * clears its entitlement cache (a new organization starts on the free plan).
 */
export function grantPlan(organizationId: string, plan: "starter" | "pro" | "enterprise") {
  const result = spawnSync(
    process.execPath,
    ["ace", "subscription:grant", organizationId, plan, "--days=30"],
    { cwd: API_DIR, env: { ...process.env, ...API_ENV }, encoding: "utf8" },
  );
  expect(result.status, `subscription:grant → ${result.stderr || result.stdout}`).toBe(0);
}
