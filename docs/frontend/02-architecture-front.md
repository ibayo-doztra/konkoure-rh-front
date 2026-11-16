# Architecture du frontend

## Stack conservée
- TanStack Start v1 (React 19, Vite 7), routage par fichiers `src/routes` ; `src/routeTree.gen.ts` est généré, ne jamais l'éditer.
- TanStack Query : chargement initial via `loader` + `ensureQueryData`, composant via `useSuspenseQuery`.
- Tailwind CSS v4 configuré dans `src/styles.css` (jetons sémantiques `bg-card`, `bg-background`, `bg-primary`, `bg-success`, `bg-warning`, `text-foreground`, `text-muted-foreground`…). Aucune couleur codée en dur sauf QR codes, pages `/careers/*` et lightbox.
- shadcn/ui dans `src/components/ui`.
- i18n : i18next, `src/lib/i18n.ts` + `src/locales/{fr,en}/{app,billing,hrm,performance,public,timeclock}.ts`. Langue persistée dans `localStorage['konkoure.lang']`, FR par défaut. Aucune clé brute affichée.
- Polices : Roboto, Helvetica, Arial, sans-serif.
- Notifications toast : sonner.

## Disposition
- `__root.tsx` : `<head>`, polices, Toaster.
- `_authenticated.tsx` : garde de session. `_authenticated.app.tsx` : layout (AppSidebar, AppHeader, AppBreadcrumbs, NotificationBell, LanguageSwitcher, ThemeToggle).
- `konkoureoffice.tsx` : layout du back office.

## Composants partagés clés
`ActionMenu`, `ConfirmDialog` + `useConfirm`, `PageHeader`, `ResponsiveTable`, `EmployeeCombobox`, `EmployeeImportDialog`, `LeaveBalanceCard`, `NfcBadgeCard`, `JobForm`, `JobQrCodeDialog`, `PublishToSocialsDialog`, `CvPreviewDialog`, `WorkZoneMap` (Google Maps), `PaymentStatusTracker`, `LeaveDetailSheet`, `PasswordInput`/`PasswordStrength`.

## Standard des modales
`DialogContent > DialogHeader + DialogBody` (carte interne), formulaires en `DialogFormGrid`, actions via `DialogActions` dans `DialogBody`. Jamais `DialogFooter`.

## Hooks
`useAuth`, `useOrg`, `useRole`, `useProfile`, `useMyEmployee`, `useSubscription`, `usePaymentClaimStatus`, `useCountUp`, `useConfirm`, `use-mobile`, `useReducedMotion`, `useReveal`, `useParallax`, `useLandingSessionGuard`.
Dans la cible, les hooks de données deviennent des `queryOptions` qui appellent le client API (voir `03`).

## SEO
Chaque route publique déclare `head()` (title, description, og:*, twitter:card). `sitemap.xml` liste offres publiées et pages publiques.
