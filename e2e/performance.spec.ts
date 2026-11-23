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

/** An employee record linked to a user account who accepted the invitation. */
async function createMember(request: APIRequestContext, owner: Owner) {
  const email = uniqueEmail("aissatou");
  const { id: employeeId } = await apiPost<{ id: string }>(request, owner, "/org/employees", {
    firstName: "Aïssatou",
    lastName: "Bah",
    email,
  });
  await apiPost(request, owner, "/org/invitations", { email, role: "employee", employeeId });
  const token = new URL(await mailLink(email, "/invitation"), API_URL).searchParams.get("token");
  const accepted = await request.post(`${API_URL}/api/v1/auth/invitations/${token}/accept`, {
    data: { password: PASSWORD, password_confirmation: PASSWORD, fullName: "Aïssatou Bah" },
  });
  expect(accepted.ok()).toBeTruthy();
  return email;
}

/** Opens the creation modal, picks the plan, fills the goal and submits it. */
async function createGoalInUi(
  page: Page,
  plan: string,
  /** Without a holder, the goal is for the reader (an employee sees no such field). */
  goal: { title: string; weight: string; holder?: string },
) {
  await page.getByRole("button", { name: "Nouvel objectif" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Plan" }).click();
  await page.getByRole("option", { name: new RegExp(plan) }).click();
  await dialog.getByRole("button", { name: "Continuer" }).click();
  await dialog.getByLabel("Titre").fill(goal.title);
  await dialog.getByLabel("Pondération (%)").fill(goal.weight);
  if (goal.holder) {
    await dialog.getByRole("combobox", { name: "Propriétaire" }).click();
    await page.getByRole("option", { name: goal.holder }).click();
  }
  await dialog.getByRole("button", { name: "Créer l'objectif" }).click();
}

test("les RH fixent l'objectif d'un employé, qui le fait progresser puis le supprime", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  const memberEmail = await createMember(request, owner);
  const year = new Date().getFullYear();
  await apiPost(request, owner, "/org/performance/plans", {
    name: `Plan annuel ${year}`,
    periodStart: `${year}-01-01`,
    periodEnd: `${year}-12-31`,
    status: "active",
  });

  await signIn(page, owner.email);
  await expect(page).toHaveURL(APP_URL);
  await open(page, "/app/performance/goals");

  await createGoalInUi(page, `Plan annuel ${year}`, {
    title: "Réduire les délais de paiement",
    weight: "60",
    holder: "Aïssatou Bah",
  });
  await expect(page.getByText("Objectif créé")).toBeVisible();
  await expect(page.getByText("Aïssatou Bah")).toBeVisible();

  // The weights of an employee on an active plan cannot exceed 100 (07 §5.2).
  await createGoalInUi(page, `Plan annuel ${year}`, {
    title: "Former deux comptables",
    weight: "50",
    holder: "Aïssatou Bah",
  });
  await expect(
    page.getByText("La pondération totale des objectifs sur ce plan ne peut pas dépasser 100."),
  ).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Fermer", exact: true }).click();

  await page.getByRole("button", { name: "Voir les objectifs" }).click();
  const row = page.getByTestId("goal-row").filter({ hasText: "Réduire les délais de paiement" });
  await expect(row.getByText("Pas démarré").first()).toBeVisible();

  // HR set the status; the progress is the holder's or their manager's (06 §9).
  await expect(row.getByLabel(/Progression de/)).toHaveCount(0);
  await row.getByRole("combobox", { name: /Statut de/ }).click();
  await page.getByRole("option", { name: "En cours" }).click();
  await expect(row.getByText("En cours").first()).toBeVisible();

  // The holder reaches 100 %, which marks the goal achieved.
  await page.context().clearCookies();
  await signIn(page, memberEmail);
  await expect(page).toHaveURL(APP_URL);
  await open(page, "/app/performance/goals");
  await page.getByRole("button", { name: "Voir les objectifs" }).click();
  const progress = row.getByLabel(/Progression de/);
  await progress.fill("100");
  await progress.press("Enter");
  await expect(row.getByText("Terminé").first()).toBeVisible();

  await row.getByRole("button", { name: "Supprimer l'objectif" }).click();
  await page.getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Aucun objectif")).toBeVisible();
});

test("un employé planifie puis termine une activité liée à son objectif", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  const memberEmail = await createMember(request, owner);
  const year = new Date().getFullYear();
  await apiPost(request, owner, "/org/performance/plans", {
    name: `Plan annuel ${year}`,
    periodStart: `${year}-01-01`,
    periodEnd: `${year}-12-31`,
    status: "active",
  });

  await signIn(page, memberEmail);
  await expect(page).toHaveURL(APP_URL);
  await open(page, "/app/performance/goals");
  await createGoalInUi(page, `Plan annuel ${year}`, {
    title: "Ouvrir l'agence de Kindia",
    weight: "40",
  });
  await expect(page.getByText("Objectif créé")).toBeVisible();

  await open(page, "/app/performance/activities");
  await page.getByRole("button", { name: "Nouvelle activité" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Objectif lié" }).click();
  await page.getByRole("option", { name: "Ouvrir l'agence de Kindia" }).click();
  await dialog.getByLabel("Titre").fill("Signer le bail du local");
  await dialog.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByText("Activité créée")).toBeVisible();

  const planned = page.getByRole("region", { name: "Planifiée" });
  const done = page.getByRole("region", { name: "Terminée" });
  await expect(planned.getByText("Signer le bail du local")).toBeVisible();

  await planned.getByRole("combobox", { name: /Statut de/ }).click();
  await page.getByRole("option", { name: "Terminée" }).click();
  await expect(done.getByText("Signer le bail du local")).toBeVisible();

  await done.getByRole("button", { name: "Supprimer « Signer le bail du local »" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByTestId("activity-card")).toHaveCount(0);
});
