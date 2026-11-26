import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { APP_URL, createOwner, invite, open, signIn, uniqueEmail, type Owner } from "./support/app";
import { API_URL, PASSWORD } from "./support/settings";

// Work schedules, lateness and the late tolerance (06 §6 « Horaires de travail »).

async function apiCall<T>(
  request: APIRequestContext,
  owner: Owner,
  method: "POST" | "PUT",
  path: string,
  data: unknown,
) {
  const response = await request.fetch(`${API_URL}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${owner.accessToken}`,
      "X-Organization-Id": owner.organizationId,
      "Idempotency-Key": crypto.randomUUID(),
    },
    data,
  });
  expect(response.ok(), `${method} ${path} → ${response.status()}`).toBeTruthy();
  return ((await response.json()) as { data: T }).data;
}

async function signInAt(page: Page, email: string, url: string) {
  await signIn(page, email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, url);
}

const randomUid = () =>
  Array.from({ length: 8 }, () => "0123456789ABCDEF"[Math.floor(Math.random() * 16)]).join("");

/** A table row on desktop, a card on mobile: the visible one holding `text`. */
const visibleText = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true });

test("les RH créent l'horaire par défaut, avec un service de nuit, puis le corrigent", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  await signInAt(page, owner.email, "/app/timeclock/schedules");
  await expect(page.getByText("Aucun horaire")).toBeVisible();

  await page.getByRole("button", { name: "Nouvel horaire" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom").fill("Bureau");
  await dialog.getByRole("switch", { name: "Horaire par défaut" }).click();
  // Monday to Friday come prefilled; Saturday gets a night shift.
  await dialog.getByRole("button", { name: "Ajouter une plage le Samedi" }).click();
  await dialog.getByLabel("Début de la plage 1 du Samedi").fill("22:00");
  await dialog.getByLabel("Fin de la plage 1 du Samedi").fill("06:00");
  await expect(dialog.getByTestId("schedule-day-sat").getByText("Lendemain")).toBeVisible();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Horaire créé")).toBeVisible();

  const card = page.getByTestId("schedule-card").filter({ hasText: "Bureau" });
  await expect(card.getByText("Par défaut")).toBeVisible();
  await expect(card.getByText("08:00–12:00")).toHaveCount(5);
  await expect(card.getByText("22:00–06:00")).toBeVisible();
  // The default schedule cannot be deleted.
  await expect(card.getByRole("button", { name: "Supprimer Bureau" })).toHaveCount(0);

  // A slot overlapping Monday's morning is refused by the API.
  await card.getByRole("button", { name: "Modifier Bureau" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Ajouter une plage le Lundi" }).click();
  await dialog.getByLabel("Début de la plage 3 du Lundi").fill("11:00");
  await dialog.getByLabel("Fin de la plage 3 du Lundi").fill("14:00");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();

  await dialog.getByRole("button", { name: "Retirer la plage 3 du Lundi" }).click();
  await dialog.getByRole("button", { name: "Retirer la plage 1 du Samedi" }).click();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Horaire mis à jour")).toBeVisible();
  await expect(card.getByText("22:00–06:00")).toHaveCount(0);
});

test("un horaire propre à un employé se crée puis se supprime", async ({ page, request }) => {
  const owner = await createOwner(request);
  await apiCall(request, owner, "POST", "/org/employees", {
    firstName: "Mariama",
    lastName: "Baldé",
  });
  await signInAt(page, owner.email, "/app/timeclock/schedules");

  await page.getByRole("button", { name: "Nouvel horaire" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom").fill("Horaire de Mariama");
  await dialog.getByRole("combobox", { name: "Type" }).click();
  await page.getByRole("option", { name: "Horaire d'un employé" }).click();
  await dialog.getByRole("combobox", { name: "Employé" }).click();
  await page.getByRole("option", { name: "Mariama Baldé" }).click();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Horaire créé")).toBeVisible();

  const card = page.getByTestId("schedule-card").filter({ hasText: "Horaire de Mariama" });
  await expect(card.getByText("Horaire de Mariama Baldé")).toBeVisible();
  await card.getByRole("button", { name: "Supprimer Horaire de Mariama" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByText("Horaire supprimé")).toBeVisible();
  await expect(card).toHaveCount(0);
});

test("la tolérance de retard s'enregistre dans les réglages", async ({ page, request }) => {
  const owner = await createOwner(request);
  await signInAt(page, owner.email, "/app/timeclock/schedules");

  const tolerance = page.getByLabel("Minutes");
  await expect(tolerance).toHaveValue("10");
  await tolerance.fill("15");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Tolérance enregistrée")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Minutes")).toHaveValue("15");
});

test("une arrivée après la tolérance apparaît en retard dans les présences", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  const employee = await apiCall<{ id: string }>(request, owner, "POST", "/org/employees", {
    firstName: "Alpha",
    lastName: "Condé",
  });
  const uid = randomUid();
  await apiCall(request, owner, "POST", `/org/employees/${employee.id}/badge`, { badgeUid: uid });
  // Every day starts at midnight with no tolerance: any arrival is late.
  const day = [{ start: "00:00", end: "23:59" }];
  await apiCall(request, owner, "POST", "/org/timeclock/schedules", {
    name: "Toute la journée",
    isDefault: true,
    weeklyPattern: { mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day },
  });
  await apiCall(request, owner, "PUT", "/org/settings", { timeclock: { lateToleranceMinutes: 0 } });
  await apiCall(request, owner, "POST", "/org/timeclock/scan", {
    badgeUid: uid,
    clientPunchId: crypto.randomUUID(),
  });

  await signInAt(page, owner.email, "/app/timeclock/logs");
  await page.getByRole("combobox", { name: "Anomalie" }).click();
  await page.getByRole("option", { name: "Retard" }).click();
  const days = page.getByTestId("attendance-card");
  await expect(days.getByText("Alpha Condé").filter({ visible: true })).toBeVisible();
  await expect(days.getByText(/^\+\d+ min$/).filter({ visible: true })).toBeVisible();
  await expect(
    days.getByText("Retard", { exact: true }).filter({ visible: true }).last(),
  ).toBeVisible();

  await page.getByRole("combobox", { name: "Anomalie" }).click();
  await page.getByRole("option", { name: "Sortie manquante" }).click();
  await expect(days.getByText("Aucune session.").filter({ visible: true })).toBeVisible();

  // The only scheduled day is late: the dashboard shows 0 % punctuality.
  await open(page, "/app");
  await expect(page.getByText("Ponctualité")).toBeVisible();
  await expect(page.getByText("0 %", { exact: true })).toBeVisible();
});

test("un manager consulte les horaires sans pouvoir les modifier", async ({ page, request }) => {
  const owner = await createOwner(request);
  const day = [{ start: "08:00", end: "17:00" }];
  await apiCall(request, owner, "POST", "/org/timeclock/schedules", {
    name: "Bureau",
    isDefault: true,
    weeklyPattern: { mon: day, tue: day, wed: day, thu: day, fri: day, sat: [], sun: [] },
  });
  const email = uniqueEmail("manager");
  const token = new URL(await invite(request, owner, email), API_URL).searchParams.get("token");
  const accepted = await request.post(`${API_URL}/api/v1/auth/invitations/${token}/accept`, {
    data: { password: PASSWORD, password_confirmation: PASSWORD, fullName: "Sékou Touré" },
  });
  expect(accepted.ok()).toBeTruthy();

  await signInAt(page, email, "/app/timeclock/schedules");
  const card = page.getByTestId("schedule-card").filter({ hasText: "Bureau" });
  await expect(card.getByText("08:00–17:00")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Nouvel horaire" })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Modifier Bureau" })).toHaveCount(0);
  await expect(page.getByText("Tolérance de retard")).toHaveCount(0);
});
