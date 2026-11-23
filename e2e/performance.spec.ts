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

test("un OKR soumis, renvoyé puis validé reçoit sa progression et un point de suivi", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  const memberEmail = await createMember(request, owner);
  const okrCard = page.getByTestId("okr-card").filter({ hasText: "Doubler les ventes à Labé" });
  const switchTo = async (email: string) => {
    await page.context().clearCookies();
    await signIn(page, email);
    await expect(page).toHaveURL(APP_URL);
    await open(page, "/app/performance/okrs");
  };

  await switchTo(memberEmail);
  await page.getByRole("button", { name: "Nouveau", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Objectif").fill("Doubler les ventes à Labé");
  await dialog
    .getByLabel(/Résultats clés/)
    .fill("Ouvrir un point de vente\nRecruter trois commerciaux");
  await dialog.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByText("Objectif créé")).toBeVisible();
  await expect(okrCard.getByText("Brouillon")).toBeVisible();
  await okrCard.getByRole("button", { name: "Soumettre au manager" }).click();
  await expect(okrCard.getByText("En attente de validation")).toBeVisible();

  // HR send it back with a mandatory comment.
  await switchTo(owner.email);
  await expect(okrCard.getByText("Aïssatou Bah", { exact: false })).toBeVisible();
  await okrCard.getByRole("button", { name: "Renvoyer" }).click();
  await page.getByLabel(/Commentaire du manager/).fill("Chiffrez le nombre de points de vente.");
  await page.getByRole("dialog").getByRole("button", { name: "Renvoyer" }).click();
  await expect(okrCard.getByText("À revoir")).toBeVisible();

  // The holder reads the comment and submits again.
  await switchTo(memberEmail);
  await expect(okrCard.getByText("Chiffrez le nombre de points de vente.")).toBeVisible();
  await okrCard.getByRole("button", { name: "Soumettre au manager" }).click();
  await expect(okrCard.getByText("En attente de validation")).toBeVisible();

  await switchTo(owner.email);
  await okrCard.getByRole("button", { name: "Valider" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Valider" }).click();
  await expect(okrCard.getByText("Validé")).toBeVisible();

  // Back to the holder: one key result out of two, then a check-in.
  await switchTo(memberEmail);
  await okrCard.getByRole("checkbox", { name: "Ouvrir un point de vente" }).click();
  await expect(okrCard.getByText("50%")).toBeVisible();
  await okrCard.getByRole("button", { name: "Points de suivi" }).click();
  await okrCard
    .getByRole("textbox", { name: "Points de suivi" })
    .fill("Local trouvé au centre-ville.");
  await okrCard.getByRole("button", { name: "Ajouter" }).click();
  await expect(okrCard.getByText("Local trouvé au centre-ville.")).toBeVisible();
  await expect(okrCard.getByText(/· 50%/)).toBeVisible();
});

test("les RH ouvrent un cycle ; l'évaluation est remplie, renvoyée, validée puis signée", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  const memberEmail = await createMember(request, owner);
  const year = new Date().getFullYear();
  const plan = await apiPost<{ id: string }>(request, owner, "/org/performance/plans", {
    name: `Plan annuel ${year}`,
    periodStart: `${year}-01-01`,
    periodEnd: `${year}-12-31`,
    status: "active",
  });
  const headers = {
    Authorization: `Bearer ${owner.accessToken}`,
    "X-Organization-Id": owner.organizationId,
  };
  const employees = await request.get(`${API_URL}/api/v1/org/employees`, { headers });
  const { data: staff } = (await employees.json()) as { data: { id: string; firstName: string }[] };
  const memberId = staff.find((e) => e.firstName === "Aïssatou")!.id;
  await apiPost(request, owner, "/org/performance/goals", {
    title: "Réduire les délais de paiement",
    employeeId: memberId,
    planId: plan.id,
    weight: 50,
  });
  const switchTo = async (email: string, url: string) => {
    await page.context().clearCookies();
    await signIn(page, email);
    await expect(page).toHaveURL(APP_URL);
    await open(page, url);
  };

  // HR create the cycle and open it on the plan: one review per present employee.
  await switchTo(owner.email, "/app/settings");
  await page.getByRole("button", { name: "Nouveau cycle" }).click();
  const cycleDialog = page.getByRole("dialog");
  await cycleDialog.getByLabel("Nom").fill(`Évaluation ${year}`);
  await cycleDialog.getByLabel("Début de période").fill(`${year}-01-01`);
  await cycleDialog.getByLabel("Fin de période").fill(`${year}-12-31`);
  await cycleDialog.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByText("Cycle créé")).toBeVisible();
  await page.getByRole("button", { name: "Ouvrir", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText(/Cycle ouvert — \d+ évaluations générées/)).toBeVisible();

  // The employee reaches it from the goals screen and submits it.
  await switchTo(memberEmail, "/app/performance/goals");
  await page.getByRole("button", { name: "Évaluer" }).click();
  await expect(page).toHaveURL(/\/app\/performance\/reviews\/[0-9a-f-]{36}$/);
  const reviewUrl = new URL(page.url()).pathname;
  await page.getByLabel("Commentaire employé").fill("Délais ramenés à 30 jours.");
  await page.getByLabel("Auto-évaluation").fill("Une année solide.");
  await page.getByRole("combobox", { name: "Note que je m'attribue" }).click();
  await page.getByRole("option", { name: "3 — Atteint les attentes" }).click();
  await page.getByRole("button", { name: "Soumettre au manager" }).click();
  await expect(page.getByText("Évaluation soumise à votre manager")).toBeVisible();

  // HR send it back with a reason.
  await switchTo(owner.email, reviewUrl);
  await expect(page.getByText("Délais ramenés à 30 jours.")).toBeVisible();
  await page.getByRole("button", { name: "Renvoyer" }).click();
  await page.getByLabel(/Motif du renvoi/).fill("Précisez les montants recouvrés.");
  await page.getByRole("dialog").getByRole("button", { name: "Renvoyer" }).click();
  await expect(page.getByText("Évaluation renvoyée à son propriétaire")).toBeVisible();

  // The employee reads the reason and submits again.
  await switchTo(memberEmail, reviewUrl);
  await expect(page.getByText("Précisez les montants recouvrés.")).toBeVisible();
  await page
    .getByLabel("Commentaire employé")
    .fill("Délais à 30 jours, 120 millions GNF recouvrés.");
  await page.getByRole("button", { name: "Soumettre au manager" }).click();
  await expect(page.getByText("Évaluation soumise à votre manager")).toBeVisible();

  // HR validate with a score and a global comment.
  await switchTo(owner.email, reviewUrl);
  await page.getByLabel("Commentaire manager").fill("Objectif tenu.");
  await page.getByLabel("Évaluation manager").fill("Très bon travail sur le recouvrement.");
  await page.getByRole("combobox", { name: "Note attribuée" }).click();
  await page.getByRole("option", { name: "3 — Atteint les attentes" }).click();
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByText("Évaluation validée avec succès")).toBeVisible();

  // The employee signs.
  await switchTo(memberEmail, reviewUrl);
  await expect(page.getByText("Très bon travail sur le recouvrement.")).toBeVisible();
  await page.getByRole("button", { name: "Signer" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Signer" }).click();
  await expect(page.getByText("Évaluation signée", { exact: true }).first()).toBeVisible();
});
