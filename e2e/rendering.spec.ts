import { expect, test } from "@playwright/test";
import { fillSignup, open, uniqueEmail } from "./support/app";

const pages = [
  { path: "/login", fr: "Bon retour parmi nous", en: "Welcome back" },
  { path: "/signup", fr: "Créer votre espace", en: "Create your workspace" },
  { path: "/reset-password", fr: "Réinitialiser le mot de passe", en: "Reset password" },
  { path: "/verify-email", fr: "Vérification de votre e-mail", en: "Verifying your email" },
  { path: "/invitation", fr: "Activer mon compte", en: "Activate my account" },
];

for (const language of ["fr", "en"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test.describe(`${language} / ${theme}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.addInitScript(
          ([lang, mode]) => {
            localStorage.setItem("konkoure.lang", lang);
            localStorage.setItem("theme", mode);
          },
          [language, theme],
        );
      });

      for (const target of pages) {
        test(`${target.path} s'affiche correctement`, async ({ page }) => {
          await open(page, target.path);
          await expect(page.getByText(target[language], { exact: true }).first()).toBeVisible();
          await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));

          const body = await page.locator("body").innerText();
          expect(body).not.toMatch(/\b(auth|onboarding)\.[a-zA-Z]+/);

          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          );
          expect(overflow).toBeLessThanOrEqual(0);
        });
      }
    });
  }
}

test("la langue choisie survit au rechargement de la page", async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("konkoure.lang", "en");
    }
  });
  await open(page, "/login");
  await expect(page.getByText("Welcome back", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Welcome back", { exact: true }).first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("l'écran de vérification est traduit en anglais", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("konkoure.lang", "en"));
  await open(page, "/signup");
  await expect(page.getByText("Create your workspace").first()).toBeVisible();
  await fillSignup(page, uniqueEmail("english"));
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page.getByText("Confirm your email address")).toBeVisible();
  await expect(page.getByRole("button", { name: "Resend verification email" })).toBeVisible();
});
