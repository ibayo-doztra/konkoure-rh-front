import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  APP_URL,
  createOwner,
  mailLink,
  open,
  signIn,
  uniqueEmail,
  type Owner,
} from "./support/app";
import { API_URL, PASSWORD } from "./support/settings";

async function signInAt(page: Page, email: string, url: string) {
  await signIn(page, email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, url);
}

async function apiPost<T>(request: APIRequestContext, owner: Owner, path: string, data: unknown) {
  const response = await request.post(`${API_URL}/api/v1${path}`, {
    headers: {
      Authorization: `Bearer ${owner.accessToken}`,
      "X-Organization-Id": owner.organizationId,
    },
    data,
  });
  expect(response.ok(), `${path} → ${response.status()}`).toBeTruthy();
  return ((await response.json()) as { data: T }).data;
}

const createDepartment = (request: APIRequestContext, owner: Owner, name: string) =>
  apiPost<{ id: string }>(request, owner, "/org/departments", { name });

const createEmployee = (
  request: APIRequestContext,
  owner: Owner,
  data: { firstName: string; lastName: string; email?: string; departmentId?: string },
) => apiPost<{ id: string }>(request, owner, "/org/employees", data);

async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).click();
}

test("les RH créent un employé puis le retrouvent et modifient sa fiche", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  await createDepartment(request, owner, "Logistique");
  await signInAt(page, owner.email, "/app/employees");

  await page.getByRole("button", { name: "Ajouter un employé" }).click();
  const dialog = page.getByRole("dialog");
  await page.locator("#employee-first-name").fill("Aminata");
  await page.locator("#employee-last-name").fill("Sylla");
  await page.locator("#employee-email").fill(uniqueEmail("aminata"));
  await page.locator("#employee-phone").fill("622 12 34 56");
  await page.locator("#employee-job").fill("Comptable");
  await choose(page, "Département *", "Logistique");
  await choose(page, "Manager (N+1) *", "Aucun manager (direction)");
  await page.locator("#employee-hire-date").fill("2026-01-05");
  await page.locator("#employee-birth-date").fill("1994-03-12");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Aminata Sylla")).toBeVisible();

  await page.getByLabel("Nom, e-mail ou matricule").fill("Sylla");
  await expect(page.locator("#main-content").getByText("Mamadou Diallo")).toBeHidden();
  const card = page.locator("div.bg-card", { hasText: "Aminata Sylla" }).last();
  await card.getByRole("button", { name: "Voir" }).click();

  await expect(page.getByRole("heading", { name: "Aminata Sylla" })).toBeVisible();
  await page.getByRole("button", { name: "Modifier : Informations personnelles" }).click();
  await page.locator("#edit-job").fill("Cheffe comptable");
  await page.locator("#edit-address").fill("Kaloum");
  await page.locator("#edit-city").fill("Conakry");
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Cheffe comptable")).toBeVisible();
  await expect(page.getByText("Kaloum, Conakry")).toBeVisible();

  await page.getByRole("button", { name: "Modifier : Contact d'urgence" }).click();
  await page.locator("#emergency-name").fill("Ibrahima Sylla");
  await page.locator("#emergency-relation").fill("Frère");
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Ibrahima Sylla")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Kaloum, Conakry")).toBeVisible();
  await expect(page.getByText("Ibrahima Sylla")).toBeVisible();
});

test("un employé invité consulte sa fiche sans pouvoir la modifier", async ({ page, request }) => {
  const owner = await createOwner(request);
  const email = uniqueEmail("salarie");
  const employee = await createEmployee(request, owner, {
    firstName: "Oumar",
    lastName: "Keita",
    email,
  });
  await signInAt(page, owner.email, "/app/employees");

  const card = page.locator("div.bg-card", { hasText: "Oumar Keita" }).last();
  await expect(card.getByText("Sans compte")).toBeVisible();
  await card.getByRole("button", { name: "Inviter à rejoindre" }).click();
  await expect(card.getByText("Invitation envoyée")).toBeVisible();

  const token = new URL(await mailLink(email, "/invitation"), API_URL).searchParams.get("token");
  const accepted = await request.post(`${API_URL}/api/v1/auth/invitations/${token}/accept`, {
    data: { password: PASSWORD, password_confirmation: PASSWORD, fullName: "Oumar Keita" },
  });
  expect(accepted.ok()).toBeTruthy();

  await page.reload();
  await expect(
    page.locator("div.bg-card", { hasText: "Oumar Keita" }).last().getByText("Compte actif"),
  ).toBeVisible();

  await page.context().clearCookies();
  await signInAt(page, email, `/app/employees/${employee.id}`);
  await expect(page.getByRole("heading", { name: "Oumar Keita" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Modifier :/ })).toHaveCount(0);
});

test("supprimer un département occupé impose de déplacer ses employés", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  const source = await createDepartment(request, owner, "Atelier");
  await createDepartment(request, owner, "Production");
  await createEmployee(request, owner, {
    firstName: "Mariama",
    lastName: "Baldé",
    departmentId: source.id,
  });
  await signInAt(page, owner.email, "/app/departments");

  // A table row on desktop, a card on mobile: only the visible one exposes its button.
  const actions = page.getByRole("button", { name: "Actions" });
  await page
    .locator("tr, div")
    .filter({ hasText: "Atelier" })
    .filter({ has: actions })
    .last()
    .getByRole("button", { name: "Actions" })
    .click();
  await page.getByRole("menuitem", { name: "Supprimer" }).click();

  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: "Supprimer" });
  await expect(confirm).toBeDisabled();
  await choose(page, "Déplacer les employés vers", "Production");
  await confirm.click();

  await expect(page.getByText("Département supprimé")).toBeVisible();
  await expect(page.getByText("Atelier")).toBeHidden();
});
