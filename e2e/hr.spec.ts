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
  await expect(page.locator("#main-content").getByText("Mamadou Diallo")).toHaveCount(0);
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
  await expect(page.getByText("Atelier")).toHaveCount(0);
});

const isoDay = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

/** A table row on desktop, a card on mobile: the visible one holding `text` and `button`. */
function rowWith(page: Page, text: string, button: string) {
  return page
    .locator("tr, div")
    .filter({ hasText: text })
    .filter({ has: page.getByRole("button", { name: button, exact: true }) })
    .last();
}

test("les RH créent, modifient, clôturent et suppriment des contrats", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  await createEmployee(request, owner, { firstName: "Aminata", lastName: "Sylla" });
  const other = await createEmployee(request, owner, { firstName: "Sékou", lastName: "Touré" });
  await apiPost(request, owner, "/org/contracts", {
    employeeId: other.id,
    type: "cdi",
    startDate: isoDay(-10),
  });
  await signInAt(page, owner.email, "/app/contracts");

  await page.getByRole("button", { name: "Nouveau contrat" }).click();
  await choose(page, "Employé", "Aminata Sylla");
  await choose(page, "Type", "CDD");
  await choose(page, "Statut", "Actif");
  await page.locator("#contract-start").fill(isoDay(-60));
  await page.locator("#contract-end").fill(isoDay(300));
  await page.locator("#contract-salary").fill("3500000");
  await page.getByRole("dialog").getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Contrat créé")).toBeVisible();

  await rowWith(page, "Aminata Sylla", "Modifier")
    .getByRole("button", { name: "Modifier", exact: true })
    .click();
  await expect(page.getByRole("combobox", { name: "Employé" })).toBeDisabled();
  await page.locator("#contract-hours").fill("40");
  await page.getByRole("dialog").getByRole("button", { name: "Mettre à jour" }).click();
  await expect(page.getByText("Contrat mis à jour")).toBeVisible();

  await rowWith(page, "Aminata Sylla", "Actions")
    .getByRole("button", { name: "Actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Clôturer" }).click();
  await expect(page.locator("#contract-close-date")).toHaveValue(isoDay(0));
  await page.getByRole("button", { name: "Confirmer la clôture" }).click();
  await expect(page.getByText("Contrat clôturé")).toBeVisible();
  // Only Aminata's contract is closed; Sékou's stays a draft.
  await expect(page.getByText("Terminé", { exact: true }).filter({ visible: true })).toBeVisible();

  await rowWith(page, "Sékou Touré", "Actions")
    .getByRole("button", { name: "Actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Supprimer" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Contrat supprimé")).toBeVisible();
  await expect(page.getByText("Sékou Touré")).toHaveCount(0);
});

test("l'import d'employés est bloqué tant que le fichier contient une erreur", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  await signInAt(page, owner.email, "/app/employees");

  const upload = (rows: string[]) =>
    page.locator('input[type="file"][accept=".xlsx,.csv"]').setInputFiles({
      name: "employes.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(["Nom;Prénom;E-mail", ...rows].join("\n"), "utf8"),
    });
  const fanta = uniqueEmail("fanta");

  await page.getByRole("button", { name: "Actions employés" }).click();
  await page.getByRole("menuitem", { name: "Importer des employés" }).click();
  const dialog = page.getByRole("dialog");

  await upload(["Camara;Fanta;adresse-invalide", `Bah;Alpha;${uniqueEmail("alpha")}`]);
  await expect(dialog.getByText("1 en erreur")).toBeVisible();
  await expect(dialog.getByText("Corrigez le fichier avant d'importer")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Importer", exact: true })).toBeDisabled();

  await dialog.getByRole("button", { name: "Choisir un autre fichier" }).click();
  await upload([`Camara;Fanta;${fanta}`, `Bah;Alpha;${uniqueEmail("alpha")}`]);
  await expect(dialog.getByText("2 à créer")).toBeVisible();
  await dialog.getByRole("button", { name: "Importer", exact: true }).click();
  await expect(page.getByText("Import terminé : 2 créé(s), 0 mis à jour.")).toBeVisible();
  await expect(page.getByText("Fanta Camara")).toBeVisible();
  await expect(page.getByText("Alpha Bah")).toBeVisible();
});

test("les RH attribuent puis révoquent le badge NFC d'un employé", async ({ page, request }) => {
  const owner = await createOwner(request);
  const employee = await createEmployee(request, owner, {
    firstName: "Mariama",
    lastName: "Diallo",
  });
  // A UID is unique across organizations: each run uses its own.
  const uid = Array.from({ length: 8 }, () => "0123456789ABCDEF"[Math.floor(Math.random() * 16)])
    .join("")
    .replace(/(..)(?!$)/g, "$1:");
  const lastFour = uid.replace(/:/g, "").slice(-4);
  await signInAt(page, owner.email, `/app/employees/${employee.id}`);

  await expect(page.getByText("Aucun badge attribué.")).toBeVisible();
  await page.locator("#nfc-uid").fill(uid);
  const assigned = page.waitForResponse(
    (r) => r.url().endsWith(`/employees/${employee.id}/badge`) && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Attribuer" }).click();
  const response = await assigned;
  expect(response.status(), await response.text()).toBe(201);
  await expect(page.getByText("Badge attribué", { exact: true })).toBeVisible();
  const current = page.getByTestId("badge-uid");
  await expect(current).toContainText(lastFour);
  await expect(current).not.toContainText(uid.replace(/:/g, "").slice(0, 4));
  await expect(page.getByText("Attribué", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Révoquer" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Révoquer" }).click();
  await expect(page.getByText("Badge révoqué")).toBeVisible();
  await expect(page.getByText("Aucun badge attribué.")).toBeVisible();
  await expect(page.getByText("Révoqué", { exact: true })).toBeVisible();
});

test("les RH ajustent le solde de congés d'un employé avec un motif", async ({ page, request }) => {
  const owner = await createOwner(request);
  const employee = await createEmployee(request, owner, {
    firstName: "Djénabou",
    lastName: "Sylla",
  });
  const balanceOf = async () => {
    const response = await request.get(`${API_URL}/api/v1/org/leaves/balances`, {
      headers: {
        Authorization: `Bearer ${owner.accessToken}`,
        "X-Organization-Id": owner.organizationId,
      },
      params: { employeeId: employee.id },
    });
    const rows = ((await response.json()) as { data: { leaveType: string; balance: number }[] })
      .data;
    return rows.find((r) => r.leaveType === "annual")?.balance ?? 0;
  };
  await signInAt(page, owner.email, `/app/employees/${employee.id}`);

  await page.getByRole("button", { name: "Ajuster" }).click();
  const dialog = page.getByRole("dialog");
  const submit = dialog.getByRole("button", { name: "Ajuster le solde" });
  await dialog.getByLabel("Jours à ajouter ou retirer").fill("0");
  await dialog.getByLabel("Motif").fill("Report validé par la direction");
  await expect(submit).toBeDisabled();

  await dialog.getByLabel("Jours à ajouter ou retirer").fill("2,5");
  await submit.click();
  await expect(page.getByText(/^Solde ajusté/)).toBeVisible();
  // The first adjustment opens the year's line with the annual entitlement.
  const after = await balanceOf();
  expect(after % 1).toBe(0.5);
  await expect(
    page.getByText(`Solde ajusté : ${String(after).replace(".", ",")} j disponibles`),
  ).toBeVisible();
});
