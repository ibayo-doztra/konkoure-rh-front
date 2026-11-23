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

const headers = (owner: Owner) => ({
  Authorization: `Bearer ${owner.accessToken}`,
  "X-Organization-Id": owner.organizationId,
});

async function apiPost<T>(request: APIRequestContext, owner: Owner, path: string, data: unknown) {
  const response = await request.post(`${API_URL}/api/v1${path}`, {
    headers: headers(owner),
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

/** An employee record linked to a user account who accepted the invitation. */
async function createMember(request: APIRequestContext, owner: Owner, firstName: string) {
  const email = uniqueEmail(firstName.toLowerCase());
  const employee = await apiPost<{ id: string }>(request, owner, "/org/employees", {
    firstName,
    lastName: "Kouyaté",
    email,
  });
  await apiPost(request, owner, "/org/invitations", {
    email,
    role: "employee",
    employeeId: employee.id,
  });
  const token = new URL(await mailLink(email, "/invitation"), API_URL).searchParams.get("token");
  const accepted = await request.post(`${API_URL}/api/v1/auth/invitations/${token}/accept`, {
    data: { password: PASSWORD, password_confirmation: PASSWORD, fullName: `${firstName} Kouyaté` },
  });
  expect(accepted.ok()).toBeTruthy();
  const login = await request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email, password: PASSWORD },
  });
  const { accessToken } = ((await login.json()) as { data: { accessToken: string } }).data;
  return { email, employeeId: employee.id, accessToken };
}

test("le tableau de bord affiche les chiffres de l'API et suit la période choisie", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  for (const firstName of ["Aïssatou", "Ibrahima", "Mariam"]) {
    await apiPost(request, owner, "/org/employees", { firstName, lastName: "Bah" });
  }
  const response = await request.get(`${API_URL}/api/v1/org/dashboard?period=month`, {
    headers: headers(owner),
  });
  const { headcount } = ((await response.json()) as { data: { headcount: { total: number } } })
    .data;
  await signInAt(page, owner.email, "/app");

  await expect(page.getByTestId("kpi-employees")).toHaveText(String(headcount.total));
  await expect(page.getByRole("heading", { name: "Effectifs", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Congés", exact: true })).toBeVisible();
  // Recruitment and performance are not delivered by the API yet.
  await expect(page.getByRole("heading", { name: "Recrutement", exact: true })).toHaveCount(0);

  const monthRange = await page.getByText(/^Du .* au .*$/).textContent();
  await page.getByRole("radio", { name: "Semaine" }).click();
  await expect(page).toHaveURL(/period=week/);
  await expect(page.getByText(/^Du .* au .*$/)).not.toHaveText(monthRange ?? "");
});

test("une demande de congé notifie les RH, qui ouvrent la notification", async ({
  page,
  request,
}) => {
  const owner = await createOwner(request);
  const member = await createMember(request, owner, "Saran");
  const year = new Date().getFullYear() + 1;
  const created = await request.post(`${API_URL}/api/v1/org/leaves`, {
    headers: {
      Authorization: `Bearer ${member.accessToken}`,
      "X-Organization-Id": owner.organizationId,
    },
    data: { type: "sick", startDate: `${year}-02-02`, endDate: `${year}-02-03` },
  });
  expect(created.ok(), `leave → ${created.status()}`).toBeTruthy();
  await signInAt(page, owner.email, "/app");

  await expect(page.getByTestId("notifications-unread")).toHaveText("1");
  await page.getByRole("button", { name: "Notifications" }).click();
  const item = page.getByRole("dialog").getByRole("button").filter({ hasText: "Saran" });
  await expect(item).toBeVisible();
  await item.click();
  await expect(page).toHaveURL(/\/app\/leaves/);
  await expect(page.getByTestId("notifications-unread")).toHaveCount(0);
});
