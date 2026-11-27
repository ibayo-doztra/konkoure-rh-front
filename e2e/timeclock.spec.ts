import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { APP_URL, createOwner, open, signIn, type Owner } from "./support/app";
import { API_URL } from "./support/settings";

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

/** A UID is unique across organizations: each test uses its own. */
const randomUid = () =>
  Array.from({ length: 8 }, () => "0123456789ABCDEF"[Math.floor(Math.random() * 16)]).join("");

/** A table row on desktop, a card on mobile: the visible one holding `text`. */
const visibleText = (scope: Page | Locator, text: string) =>
  scope.getByText(text, { exact: true }).filter({ visible: true });

test("un badge scanné enregistre l'arrivée puis la sortie, visibles dans les présences", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  const employee = await apiPost<{ id: string }>(request, owner, "/org/employees", {
    firstName: "Kadiatou",
    lastName: "Sow",
  });
  const uid = randomUid();
  await apiPost(request, owner, `/org/employees/${employee.id}/badge`, { badgeUid: uid });
  await signInAt(page, owner.email, "/app/timeclock/scan");

  const scan = async (value: string) => {
    await page.locator("#manual").fill(value);
    await page.getByRole("button", { name: "Scanner" }).click();
  };

  await scan(uid);
  await expect(page.getByText("Kadiatou Sow")).toBeVisible();
  await expect(page.getByText("Arrivée enregistrée à", { exact: false })).toBeVisible();

  await scan(uid);
  await expect(page.getByText("Sortie enregistrée à", { exact: false })).toBeVisible();

  await scan(randomUid());
  await expect(page.getByText("Pointage refusé")).toBeVisible();

  await open(page, "/app/timeclock/logs");
  const days = page.getByTestId("attendance-card");
  await expect(visibleText(days, "Kadiatou Sow")).toBeVisible();
  await expect(visibleText(days, "Terminée")).toBeVisible();
});

test("les RH consultent puis suppriment une zone de travail", async ({ page, request }) => {
  const owner = await createOwner(request);
  await apiPost(request, owner, "/org/timeclock/zones", {
    name: "Siège Kaloum",
    shape: "circle",
    latitude: 9.5092,
    longitude: -13.7122,
    radiusMeters: 150,
  });
  await signInAt(page, owner.email, "/app/timeclock/zones");

  await expect(page.getByText("Siège Kaloum")).toBeVisible();
  await expect(page.getByText("Cercle · 150m")).toBeVisible();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Zone supprimée")).toBeVisible();
  await expect(page.getByText("Aucune zone définie.")).toBeVisible();
});

test("un jeton de kiosque scanne les badges jusqu'à sa révocation", async ({ page, request }) => {
  const owner = await createOwner(request);
  const employee = await apiPost<{ id: string }>(request, owner, "/org/employees", {
    firstName: "Fodé",
    lastName: "Camara",
  });
  const uid = randomUid();
  await apiPost(request, owner, `/org/employees/${employee.id}/badge`, { badgeUid: uid });
  await signInAt(page, owner.email, "/app/timeclock/kiosks");

  await page.getByRole("button", { name: "Nouveau jeton" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom de la tablette").fill("Accueil Kaloum");
  await dialog.getByRole("button", { name: "Créer le jeton" }).click();
  const tokenField = dialog.getByLabel("Jeton", { exact: true });
  await expect(tokenField).toHaveValue(/^kd_/);
  const token = await tokenField.inputValue();
  await dialog.getByRole("button", { name: "J'ai copié le jeton" }).click();
  await expect(visibleText(page, "Accueil Kaloum")).toBeVisible();
  await expect(visibleText(page, "Actif")).toBeVisible();

  // The tablet scans with the token alone: the organization comes from it.
  const scan = () =>
    request.post(`${API_URL}/api/v1/org/timeclock/scan`, {
      headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": crypto.randomUUID() },
      data: { badgeUid: uid, clientPunchId: crypto.randomUUID() },
    });
  expect((await scan()).status()).toBe(201);

  await page
    .getByRole("button", { name: "Révoquer Accueil Kaloum" })
    .filter({ visible: true })
    .click();
  await page.getByRole("button", { name: "Révoquer", exact: true }).click();
  await expect(page.getByText("Jeton révoqué")).toBeVisible();
  await expect(visibleText(page, "Révoqué")).toBeVisible();
  expect((await scan()).status()).toBe(401);
});

test("l'écran du jour sépare présents et absents, et l'export des pointages se lance", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  const present = await apiPost<{ id: string }>(request, owner, "/org/employees", {
    firstName: "Hawa",
    lastName: "Keïta",
  });
  await apiPost(request, owner, "/org/employees", { firstName: "Ousmane", lastName: "Barry" });
  const uid = randomUid();
  await apiPost(request, owner, `/org/employees/${present.id}/badge`, { badgeUid: uid });
  await apiPost(request, owner, "/org/timeclock/scan", {
    badgeUid: uid,
    clientPunchId: crypto.randomUUID(),
  });
  await signInAt(page, owner.email, "/app/timeclock/today");

  // The owner has an employee record too: 3 employees, only Hawa has punched in.
  await expect(page.getByTestId("today-present")).toHaveText(/^1\s*\/\s*3$/);
  await expect(page.getByTestId("today-absent")).toHaveText(/^2\s*\/\s*3$/);
  await expect(visibleText(page, "Hawa Keïta")).toBeVisible();
  await expect(visibleText(page, "Sur place")).toBeVisible();
  await page.getByRole("tab", { name: "Absents" }).click();
  await expect(visibleText(page, "Ousmane Barry")).toBeVisible();

  await open(page, "/app/timeclock/logs");
  await page.getByRole("button", { name: "Exporter" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("CSV").check();
  await dialog.getByRole("button", { name: "Lancer l'export" }).click();
  await expect(page.getByText("Export lancé : vous recevrez le fichier par e-mail.")).toBeVisible();
});

test("les RH corrigent puis suppriment un pointage", async ({ page, request }) => {
  const owner = await createOwner(request);
  const employee = await apiPost<{ id: string }>(request, owner, "/org/employees", {
    firstName: "Saran",
    lastName: "Kouyaté",
  });
  const uid = randomUid();
  await apiPost(request, owner, `/org/employees/${employee.id}/badge`, { badgeUid: uid });
  await apiPost(request, owner, "/org/timeclock/scan", {
    badgeUid: uid,
    clientPunchId: crypto.randomUUID(),
  });
  await signInAt(page, owner.email, "/app/timeclock/logs");

  const punches = page.getByTestId("punches-card");
  await expect(visibleText(punches, "Arrivée")).toBeVisible();
  await page
    .getByRole("button", { name: /^Corriger le pointage Saran Kouyaté/ })
    .filter({ visible: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Type" }).click();
  await page.getByRole("option", { name: "Départ" }).click();
  await dialog.getByLabel("Motif de la correction").fill("Erreur de type au kiosque");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Pointage corrigé")).toBeVisible();
  await expect(visibleText(punches, "Erreur de type au kiosque")).toBeVisible();
  await expect(visibleText(punches, "Départ")).toBeVisible();

  await page
    .getByRole("button", { name: /^Supprimer le pointage Saran Kouyaté/ })
    .filter({ visible: true })
    .click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByText("Pointage supprimé")).toBeVisible();
  await expect(visibleText(punches, "Aucun pointage sur la période.")).toBeVisible();
});

test("le journal des badges montre attributions, remplacements et scans refusés", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  const headers = {
    Authorization: `Bearer ${owner.accessToken}`,
    "X-Organization-Id": owner.organizationId,
  };
  const employee = await apiPost<{ id: string }>(request, owner, "/org/employees", {
    firstName: "Mamadou",
    lastName: "Bah",
  });
  const other = await apiPost<{ id: string }>(request, owner, "/org/employees", {
    firstName: "Aïssatou",
    lastName: "Barry",
  });
  const assign = async (employeeId: string, badgeUid: string) => {
    const response = await request.post(`${API_URL}/api/v1/org/employees/${employeeId}/badge`, {
      headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
      data: { badgeUid },
    });
    expect(response.status(), await response.text()).toBe(201);
  };
  const first = randomUid();
  const second = randomUid();
  await assign(employee.id, first);
  await assign(employee.id, second); // replaces the first one
  await assign(other.id, randomUid());
  const unknown = randomUid();
  const rejected = await request.post(`${API_URL}/api/v1/org/timeclock/scan`, {
    headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
    data: { badgeUid: unknown, clientPunchId: crypto.randomUUID() },
  });
  expect(rejected.status()).toBe(404);

  await signInAt(page, owner.email, "/app/timeclock/badges");
  await expect(page.getByRole("heading", { name: "Journal des badges" })).toBeVisible();
  const journal = page.getByTestId("badge-journal");
  await expect(visibleText(journal, "Scan refusé")).toBeVisible();
  await expect(visibleText(journal, "Badge inconnu")).toBeVisible();
  await expect(visibleText(journal, "Remplacé")).toBeVisible();
  await expect(visibleText(journal, "Attribué")).toHaveCount(3);
  // UIDs stay masked: only the last four characters are shown.
  await expect(journal.getByText(first, { exact: true })).toHaveCount(0);
  await expect(
    journal.getByText(new RegExp(`${unknown.slice(-4)}$`)).filter({ visible: true }),
  ).toBeVisible();

  await page.getByRole("combobox", { name: "Employé" }).click();
  await page.getByRole("option", { name: "Aïssatou Barry" }).click();
  await expect(visibleText(journal, "Attribué")).toHaveCount(1);
  await expect(visibleText(journal, "Scan refusé")).toHaveCount(0);
  await expect(visibleText(journal, "Remplacé")).toHaveCount(0);
});
