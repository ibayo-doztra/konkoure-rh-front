// Shapes consumed by the frontend session layer.
//
// ⚠️ PROPOSED CONTRACT — `GET /api/v1/me` is only described in prose in
// konkoure-rh-api/docs/backend/06-api-reference.md ("profil, organisation active,
// rôles, employé lié, abonnement, modules, super-admin"). This exact shape must be
// validated and written into 06-api-reference.md before the backend implements it.
import type { AppRole } from "@/lib/permissions";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  preferredLanguage: "fr" | "en" | null;
  /** Invited account that must set its own password before using the app. */
  mustChangePassword: boolean;
}

export interface MeOrganization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  defaultLanguage: string;
  defaultCurrency: string;
  plan: string;
  performanceModel: "classic" | "sap";
  roles: AppRole[];
}

export interface MeSubscription {
  planCode: string;
  planName: string;
  maxEmployees: number;
  aiCreditsPerMonth: number;
  status: "trialing" | "active" | "past_due" | "canceled";
  currentPeriodEnd: string | null;
  cycle: "mensuel" | "annuel";
  priceGnf: number;
  trialEndsAt: string | null;
  /** Paid plan still effective (including cancellation until period end). */
  planEffective: boolean;
}

export interface Me {
  user: AuthUser;
  isPlatformAdmin: boolean;
  organizations: MeOrganization[];
  activeOrganizationId: string | null;
  employee: { id: string; firstName: string | null; lastName: string | null } | null;
  subscription: MeSubscription | null;
  /** Effective modules computed server-side (entitlements); the client only hides UI. */
  modules: string[];
}

/** Payload of `POST /auth/login` and `POST /auth/register` (06 §1). */
export interface AuthTokens {
  user: Pick<AuthUser, "id" | "email" | "fullName" | "emailVerified">;
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  refreshExpiresIn?: number;
}
