// Shapes consumed by the frontend session layer.
//
// Contract: konkoure-rh-api/docs/backend/06-api-reference.md §2 (`GET /me`).
// Until the HR module ships, the API returns `employee: null`.
import type { AppRole } from "@/lib/permissions";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  preferredLanguage: "fr" | "en" | null;
  /** Imported account that must reset its password (`users.must_reset_password`). */
  mustChangePassword: boolean;
}

export interface MeOrganization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  defaultLanguage: string;
  defaultCurrency: string;
  plan: string | null;
  performanceModel: "classic" | "sap";
  roles: AppRole[];
}

export interface MeSubscription {
  planCode: string;
  planName: string;
  maxEmployees: number;
  aiCreditsPerMonth: number;
  status: "trialing" | "active" | "past_due" | "suspended" | "canceled" | "expired";
  currentPeriodEnd: string | null;
  cycle: "monthly" | "yearly";
  priceGnf: number;
  trialEndsAt: string | null;
  /** Paid plan still effective (including cancellation until period end). */
  planEffective: boolean;
}

export interface Me {
  user: AuthUser;
  isPlatformAdmin: boolean;
  organizations: MeOrganization[];
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
