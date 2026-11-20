import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
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
const visibleText = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).filter({ visible: true });

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
  await expect(visibleText(page, "Kadiatou Sow")).toBeVisible();
  await expect(visibleText(page, "Terminée")).toBeVisible();
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
