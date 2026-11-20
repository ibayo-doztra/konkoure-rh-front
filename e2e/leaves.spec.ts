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

async function signInAt(page: Page, email: string, url: string) {
  await signIn(page, email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, url);
}

/** First Monday of February next year: weekdays, same year, no Guinean holiday. */
function nextFebruaryWeek() {
  const year = new Date().getFullYear() + 1;
  const day = new Date(Date.UTC(year, 1, 1));
  while (day.getUTCDay() !== 1) day.setUTCDate(day.getUTCDate() + 1);
  const iso = (offset: number) =>
    new Date(day.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
  return { monday: iso(0), wednesday: iso(2), friday: iso(4) };
}

/** An employee record linked to a user account who accepted the invitation. */
async function createMember(request: APIRequestContext, owner: Owner, firstName: string) {
  const email = uniqueEmail(firstName.toLowerCase());
  const employee = await apiPost<{ id: string }>(request, owner, "/org/employees", {
    firstName,
    lastName: "Camara",
    email,
  });
  await apiPost(request, owner, "/org/invitations", {
    email,
    role: "employee",
    employeeId: employee.id,
  });
  const token = new URL(await mailLink(email, "/invitation"), API_URL).searchParams.get("token");
  const accepted = await request.post(`${API_URL}/api/v1/auth/invitations/${token}/accept`, {
    data: { password: PASSWORD, password_confirmation: PASSWORD, fullName: `${firstName} Camara` },
  });
  expect(accepted.ok()).toBeTruthy();
  return { email, employeeId: employee.id };
}

/** The status badge of a request (the tabs reuse some of these words). */
const status = (page: Page, label: string) =>
  page.locator(`div:text-is("${label}")`).filter({ visible: true });

/** A table row on desktop, a card on mobile: the visible one holding `text` and `button`. */
function rowWith(page: Page, text: string, button: string) {
  return page
    .locator("tr, div")
    .filter({ hasText: text })
    .filter({ has: page.getByRole("button", { name: button, exact: true }) })
    .last();
}

test("un employé demande un congé que les RH approuvent", async ({ page, request }) => {
  const owner = await createOwner(request);
  const member = await createMember(request, owner, "Fatoumata");
  const { monday, wednesday } = nextFebruaryWeek();

  await signInAt(page, member.email, "/app/leaves");
  // No balance row yet: the API opens it with the first request of the year.
  await expect(page.getByTestId("my-balance")).toHaveText("—");
  await page.getByRole("button", { name: "Nouvelle demande" }).click();
  await page.locator("#leave-start").fill(monday);
  await page.locator("#leave-end").fill(wednesday);
  await expect(page.getByText("Estimation : 3 j", { exact: false })).toBeVisible();
  await page.locator("#leave-reason").fill("Mariage d'un proche");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText("Demande envoyée")).toBeVisible();
  await expect(status(page, "En attente")).toBeVisible();

  await page.context().clearCookies();
  await signInAt(page, owner.email, "/app/leaves");
  await rowWith(page, "Fatoumata Camara", "Approuver")
    .getByRole("button", { name: "Approuver", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Solde restant")).toBeVisible();
  await dialog.getByRole("button", { name: "Confirmer la validation" }).click();
  await expect(page.getByText("Demande approuvée")).toBeVisible();
  await expect(status(page, "Approuvé")).toBeVisible();
});

test("un refus de congé exige un motif", async ({ page, request }) => {
  const owner = await createOwner(request);
  const employee = await apiPost<{ id: string }>(request, owner, "/org/employees", {
    firstName: "Alpha",
    lastName: "Barry",
  });
  const { monday, friday } = nextFebruaryWeek();
  await apiPost(request, owner, "/org/leaves", {
    employeeId: employee.id,
    type: "sick",
    startDate: monday,
    endDate: friday,
  });
  await signInAt(page, owner.email, "/app/leaves");

  await rowWith(page, "Alpha Barry", "Refuser")
    .getByRole("button", { name: "Refuser", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: "Confirmer le refus" });
  await expect(confirm).toBeDisabled();
  await page.locator("#reject-comment").fill("Non");
  await expect(dialog.getByText("Le motif compte au moins 5 caractères.")).toBeVisible();
  await page.locator("#reject-comment").fill("Période de clôture des comptes");
  await confirm.click();
  await expect(page.getByText("Demande refusée")).toBeVisible();

  await status(page, "Refusé").click();
  await expect(page.getByText("Période de clôture des comptes")).toBeVisible();
});

test("les RH importent les jours fériés guinéens et en ajoutent un", async ({ page, request }) => {
  const owner = await createOwner(request);
  const year = new Date().getFullYear() + 1;
  await signInAt(page, owner.email, "/app/leaves/holidays");

  await page.getByRole("button", { name: "Année suivante" }).click();
  await expect(page.getByText(`Calendrier ${year}`)).toBeVisible();
  await page.getByRole("button", { name: "Importer les jours fériés guinéens" }).click();
  await expect(page.getByText(`Jours fériés guinéens de ${year} ajoutés`)).toBeVisible();
  await expect(page.getByText(`01/01/${year}`).filter({ visible: true })).toBeVisible();

  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.locator("#holiday-name").fill("Journée de l'entreprise");
  await page.locator("#holiday-date").fill(`${year}-06-15`);
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Jour férié ajouté")).toBeVisible();

  await rowWith(page, "Journée de l'entreprise", "Supprimer")
    .getByRole("button", { name: "Supprimer", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Jour férié supprimé")).toBeVisible();
  await expect(page.getByText("Journée de l'entreprise")).toHaveCount(0);
});
