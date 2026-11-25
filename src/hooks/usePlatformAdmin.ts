// Platform admin access, read from `GET /me`. The API enforces it on every
// `/platform` call: this only hides what the admin cannot do.
import { useAuth } from "@/hooks/useAuth";
import type { PlatformLevel } from "@/lib/api/types";

export function usePlatformAdmin(): {
  isAdmin: boolean;
  level: PlatformLevel | null;
  /** `root` writes. Unknown level (older API): shown, a 403 is then explained. */
  canWrite: boolean;
} {
  const { me } = useAuth();
  const isAdmin = !!me?.isPlatformAdmin;
  const level = me?.platformLevel ?? null;
  return { isAdmin, level, canWrite: isAdmin && level !== "support" };
}
