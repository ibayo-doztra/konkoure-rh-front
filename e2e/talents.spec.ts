import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
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

async function apiCall<T>(
  request: APIRequestContext,
  auth: { accessToken: string; organizationId: string },
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

async function createEmployee(
  request: APIRequestContext,
  owner: Owner,
  input: { firstName: string; lastName: string; email?: string; managerId?: string },
) {
  return apiPost<{ id: string }>(request, owner, "/org/employees", input);
}

/** An employee account linked to its record, signed in through the API. */
async function createMember(
  request: APIRequestContext,
  owner: Owner,
  input: { firstName: string; lastName: string },
) {
  const email = uniqueEmail(input.firstName.toLowerCase());
  const { id } = await createEmployee(request, owner, { ...input, email });
  await apiPost(request, owner, "/org/invitations", { email, role: "employee", employeeId: id });
  const token = new URL(await mailLink(email, "/invitation"), API_URL).searchParams.get("token");
  const accepted = await request.post(`${API_URL}/api/v1/auth/invitations/${token}/accept`, {
    data: {
      password: PASSWORD,
      password_confirmation: PASSWORD,
      fullName: `${input.firstName} ${input.lastName}`,
    },
  });
  expect(accepted.ok()).toBeTruthy();
  const login = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email, password: PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const { accessToken } = ((await login.json()) as { data: { accessToken: string } }).data;
  return { employeeId: id, auth: { accessToken, organizationId: owner.organizationId } };
}

/** A manager account linked to its employee record, who accepted the invitation. */
async function createManager(request: APIRequestContext, owner: Owner) {
  const email = uniqueEmail("aissatou");
  const { id } = await createEmployee(request, owner, {
    firstName: "Aïssatou",
    lastName: "Bah",
    email,
  });
  await apiPost(request, owner, "/org/invitations", { email, role: "manager", employeeId: id });
  const token = new URL(await mailLink(email, "/invitation"), API_URL).searchParams.get("token");
  const accepted = await request.post(`${API_URL}/api/v1/auth/invitations/${token}/accept`, {
    data: { password: PASSWORD, password_confirmation: PASSWORD, fullName: "Aïssatou Bah" },
  });
  expect(accepted.ok()).toBeTruthy();
  return { email, employeeId: id };
}

/** Picks an option of a shadcn select identified by its label. */
async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

const cell = (page: Page, skill: string, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${skill}, ${name} :`) });

test("les RH tiennent le catalogue et la matrice des compétences", async ({ page, request }) => {
  const owner = await createOwner(request);
  grantPlan(owner.organizationId, "pro");
  await createEmployee(request, owner, { firstName: "Fatoumata", lastName: "Camara" });

  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, "/app/talents/skills");
  await page.getByRole("tab", { name: "Catalogue" }).click();
  for (const [name, category] of [
    ["Comptabilité", "Finance"],
    ["Négociation", ""],
  ]) {
    await page.getByLabel("Compétence", { exact: true }).fill(name);
    await page.getByLabel("Catégorie", { exact: true }).fill(category);
    await page.getByRole("button", { name: "Ajouter" }).click();
    await expect(page.getByTestId("skill-row").filter({ hasText: name })).toBeVisible();
  }

  await page.getByRole("tab", { name: "Matrice" }).click();
  await cell(page, "Comptabilité", "Fatoumata Camara").click();
  await page.getByRole("menuitem", { name: "Niveau 4" }).click();
  await cell(page, "Négociation", "Fatoumata Camara").click();
  await page.getByRole("menuitem", { name: "Niveau 2" }).click();
  await expect(page.getByText("2 modifications non enregistrées")).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("2 niveaux enregistrés")).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Comptabilité, Fatoumata Camara : 4" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Négociation, Fatoumata Camara : 2" }),
  ).toBeVisible();

  // Removing a level deletes the assessment.
  await cell(page, "Négociation", "Fatoumata Camara").click();
  await page.getByRole("menuitem", { name: "Retirer le niveau" }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("1 niveau enregistré")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Négociation, Fatoumata Camara : non évalué" }),
  ).toBeVisible();

  // Deleting a skill from the catalogue removes its column.
  await page.getByRole("tab", { name: "Catalogue" }).click();
  await page
    .getByTestId("skill-row")
    .filter({ hasText: "Négociation" })
    .getByRole("button", { name: "Actions" })
    .click();
  await page.getByRole("menuitem", { name: "Supprimer" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByTestId("skill-row").filter({ hasText: "Négociation" })).toHaveCount(0);
});

test("les RH créent, modifient puis suppriment un plan de succession", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  grantPlan(owner.organizationId, "pro");
  await createEmployee(request, owner, { firstName: "Fatoumata", lastName: "Camara" });
  await createEmployee(request, owner, { firstName: "Ibrahima", lastName: "Sow" });

  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, "/app/talents/succession");
  await expect(page.getByText("Aucun plan défini")).toBeVisible();

  await page.getByRole("button", { name: "Nouveau plan" }).click();
  await page.getByLabel("Poste clé").fill("Directeur financier");
  await choose(page, "Titulaire", "Fatoumata Camara");
  await choose(page, "Successeur", "Ibrahima Sow");
  await choose(page, "Préparation", "Prêt dans 1 à 2 ans");
  await page.getByLabel("Notes").fill("Accompagner sur la consolidation.");
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Plan de succession créé")).toBeVisible();

  const card = page.getByTestId("succession-card").filter({ hasText: "Directeur financier" });
  await expect(card).toContainText("Fatoumata Camara");
  await expect(card).toContainText("Ibrahima Sow");
  await expect(card).toContainText("Prêt dans 1 à 2 ans");

  await card.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Modifier" }).click();
  await choose(page, "Préparation", "Prêt maintenant");
  await choose(page, "Successeur", "Personne");
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Plan de succession modifié")).toBeVisible();
  await expect(card).toContainText("Prêt maintenant");
  await expect(card).toContainText("Aucun successeur identifié");

  await card.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Supprimer" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Aucun plan défini")).toBeVisible();
});

test("un manager consulte la matrice de son équipe sans la modifier", async ({ page, request }) => {
  const owner = await createOwner(request);
  grantPlan(owner.organizationId, "pro");
  const manager = await createManager(request, owner);
  const member = await createEmployee(request, owner, {
    firstName: "Ibrahima",
    lastName: "Sow",
    managerId: manager.employeeId,
  });
  await createEmployee(request, owner, { firstName: "Fatoumata", lastName: "Camara" });
  const skill = await apiPost<{ id: string }>(request, owner, "/org/skills", {
    name: "Comptabilité",
  });
  const put = await request.put(`${API_URL}/api/v1/org/talents/skills-matrix`, {
    headers: {
      Authorization: `Bearer ${owner.accessToken}`,
      "X-Organization-Id": owner.organizationId,
    },
    data: { entries: [{ employeeId: member.id, skillId: skill.id, level: 3 }] },
  });
  expect(put.ok()).toBeTruthy();

  await signIn(page, manager.email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, "/app/talents/skills");
  await expect(page.getByRole("img", { name: "Comptabilité, Ibrahima Sow : 3" })).toBeVisible();
  // Only the team: neither the manager nor another employee.
  await expect(page.getByText("Fatoumata Camara")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Catalogue" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Comptabilité, / })).toHaveCount(0);

  await open(page, "/app/talents/succession");
  await expect(page).toHaveURL(APP_URL);
});

test("les RH notent performance et potentiel, la 9-box place les employés selon les seuils", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  grantPlan(owner.organizationId, "pro");
  const fatoumata = await createMember(request, owner, {
    firstName: "Fatoumata",
    lastName: "Camara",
  });
  await createEmployee(request, owner, { firstName: "Ibrahima", lastName: "Sow" });

  // An open cycle with one evaluation per employee.
  const year = new Date().getFullYear();
  const cycle = await apiCall<{ id: string }>(request, owner, "POST", "/org/performance/cycles", {
    name: `Évaluation ${year}`,
    frequency: "annual",
    periodStart: `${year}-01-01`,
    periodEnd: `${year}-12-31`,
  });
  await apiCall(request, owner, "POST", `/org/performance/cycles/${cycle.id}/open`);
  await apiCall(request, owner, "POST", "/org/performance/reviews", { cycleId: cycle.id });
  const reviews = await apiCall<{ id: string; employeeId: string }[]>(
    request,
    owner,
    "GET",
    `/org/performance/reviews?filter[cycleId]=${cycle.id}`,
  );
  const review = reviews.find((r) => r.employeeId === fatoumata.employeeId)!;

  // Fatoumata's evaluation goes up to `validated`.
  const path = `/org/performance/reviews/${review.id}`;
  await apiCall(request, fatoumata.auth, "PATCH", `${path}/self`, {
    selfScore: 4,
    selfGlobalComment: "Une année solide.",
  });
  await apiCall(request, fatoumata.auth, "POST", `${path}/submit-self`);
  await apiCall(request, owner, "PATCH", `${path}/manager`, {
    managerScore: 4,
    managerGlobalComment: "Très bon travail.",
  });
  await apiCall(request, owner, "POST", `${path}/validate`);

  // HR score her in the evaluation.
  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, `/app/performance/reviews/${review.id}`);
  await choose(page, "Performance", "4");
  await choose(page, "Potentiel", "5");
  await page.getByRole("button", { name: "Enregistrer les notes" }).click();
  await expect(page.getByText("Notes talents enregistrées")).toBeVisible();

  // Default thresholds (2 / 3): 4 and 5 are high.
  await open(page, "/app/talents/9box");
  const star = page.getByRole("region", { name: "Star" });
  await expect(star.getByRole("link", { name: /Fatoumata Camara/ })).toBeVisible();
  // Ibrahima's evaluation has no score yet.
  await expect(page.getByTestId("nine-box-unplaced")).toContainText("Ibrahima Sow");

  // Raising the thresholds (3 / 4) makes a performance of 4 medium.
  await page.getByRole("button", { name: "Seuils" }).click();
  await choose(page, "Niveau bas jusqu'à", "3");
  await choose(page, "Niveau moyen jusqu'à", "4");
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Seuils enregistrés")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Haut potentiel" })
      .getByRole("link", { name: /Fatoumata Camara/ }),
  ).toBeVisible();
  await expect(star.getByRole("link")).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(/basse de 1 à 3, moyenne de 4 à 4, haute de 5 à 5/)).toBeVisible();
});
