import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  APP_URL,
  createOwner,
  grantPlan,
  mailLink,
  open,
  signIn,
  uniqueEmail,
  type Owner,
} from "./support/app";
import { API_URL, PASSWORD } from "./support/settings";

// No AI key (and no network) in e2e: every AI call answers 503 E_AI_UNAVAILABLE,
// without consuming a credit. These tests check the buttons and that the
// forms keep working after the error.
const UNAVAILABLE = "L'assistant IA est momentanément indisponible. Réessayez plus tard.";

type Auth = { accessToken: string; organizationId: string };

async function call<T>(
  request: APIRequestContext,
  auth: Auth,
  method: "POST" | "PATCH" | "GET",
  path: string,
  data?: unknown,
) {
  const response = await request.fetch(`${API_URL}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "X-Organization-Id": auth.organizationId,
      "Idempotency-Key": crypto.randomUUID(),
    },
    data,
  });
  expect(response.ok(), `${method} ${path} → ${response.status()}`).toBeTruthy();
  return ((await response.json()) as { data: T }).data;
}

test("la suggestion de résultats clés signale une IA indisponible", async ({ page, request }) => {
  const owner = await createOwner(request);
  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, "/app/performance/okrs");

  await page.getByRole("button", { name: "Nouveau" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouvel objectif" });
  const suggest = dialog.getByRole("button", { name: "Suggérer avec l'IA" });
  await dialog.getByLabel(/^Objectif/).fill("Ventes");
  await expect(suggest).toBeDisabled();
  await dialog.getByLabel(/^Objectif/).fill("Augmenter les ventes à Conakry");
  await suggest.click();
  await expect(page.getByText(UNAVAILABLE)).toBeVisible();
  // The form is untouched and still usable.
  await expect(dialog.getByLabel(/^Objectif/)).toHaveValue("Augmenter les ventes à Conakry");
});

test("la rédaction d'une offre avec l'IA signale une IA indisponible", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  grantPlan(owner.organizationId, "pro");
  const job = await call<{ id: string }>(request, owner, "POST", "/org/recruitment/jobs", {
    title: "Comptable",
    contractType: "cdi",
  });
  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, `/app/recruitment/jobs/${job.id}/edit`);

  await page.getByRole("button", { name: "Rédiger avec l'IA" }).click();
  const dialog = page.getByRole("dialog", { name: "Rédiger avec l'IA" });
  await dialog.getByLabel("Précisions (facultatif)").fill("Équipe de 5 personnes.");
  await dialog.getByRole("button", { name: "Générer" }).click();
  await expect(page.getByText(UNAVAILABLE)).toBeVisible();
  await expect(dialog).toBeVisible();
});

/** An employee account with its record, signed in through the API. */
async function createMember(request: APIRequestContext, owner: Owner) {
  const email = uniqueEmail("fatoumata");
  const { id } = await call<{ id: string }>(request, owner, "POST", "/org/employees", {
    firstName: "Fatoumata",
    lastName: "Camara",
    email,
  });
  await call(request, owner, "POST", "/org/invitations", {
    email,
    role: "employee",
    employeeId: id,
  });
  const token = new URL(await mailLink(email, "/invitation"), API_URL).searchParams.get("token");
  const accepted = await request.post(`${API_URL}/api/v1/auth/invitations/${token}/accept`, {
    data: { password: PASSWORD, password_confirmation: PASSWORD, fullName: "Fatoumata Camara" },
  });
  expect(accepted.ok()).toBeTruthy();
  const login = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email, password: PASSWORD },
  });
  const { accessToken } = ((await login.json()) as { data: { accessToken: string } }).data;
  return { employeeId: id, auth: { accessToken, organizationId: owner.organizationId } };
}

test("la synthèse IA d'une évaluation signale une IA indisponible", async ({ page, request }) => {
  const owner = await createOwner(request);
  const member = await createMember(request, owner);
  const year = new Date().getFullYear();
  const cycle = await call<{ id: string }>(request, owner, "POST", "/org/performance/cycles", {
    name: `Évaluation ${year}`,
    frequency: "annual",
    periodStart: `${year}-01-01`,
    periodEnd: `${year}-12-31`,
  });
  await call(request, owner, "POST", `/org/performance/cycles/${cycle.id}/open`);
  await call(request, owner, "POST", "/org/performance/reviews", { cycleId: cycle.id });
  const reviews = await call<{ id: string; employeeId: string }[]>(
    request,
    owner,
    "GET",
    `/org/performance/reviews?filter[cycleId]=${cycle.id}`,
  );
  const review = reviews.find((r) => r.employeeId === member.employeeId)!;
  // The evaluation is started by the employee.
  await call(request, member.auth, "PATCH", `/org/performance/reviews/${review.id}/self`, {
    selfGlobalComment: "Une année solide.",
  });

  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, `/app/performance/reviews/${review.id}`);
  await expect(
    page.getByText("Aucune synthèse pour le moment (1 crédit IA par génération)."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Générer la synthèse" }).click();
  await expect(page.getByText(UNAVAILABLE)).toBeVisible();
});
