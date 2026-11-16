import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";

interface MyEmployee {
  id: string;
  first_name: string | null;
  last_name: string | null;
  user_id: string | null;
}

interface UseMyEmployeeResult {
  myEmployee: MyEmployee | null;
  isSuperAdmin: boolean;
  loading: boolean;
  /** Id de la fiche employé liée à l'utilisateur courant (via `GET /me`), sinon null. */
  ensureMyEmployee: () => Promise<string | null>;
  /**
   * Garantit qu'une action métier peut être effectuée :
   * - fiche employé liée → son id
   * - sinon owner / hr_admin → null (autorisé pour maintenance)
   * - sinon → toast d'erreur + false (action à bloquer)
   */
  requireEmployee: () => Promise<string | null | false>;
  refresh: () => Promise<void>;
}

// The former Supabase version created the employee record on the fly. Linking a
// user to an employee is now the API's job (onboarding / invitation acceptance).
export function useMyEmployee(): UseMyEmployeeResult {
  const { me, user, loading, reload } = useAuth();
  const { isAdmin } = useRole();

  const myEmployee = useMemo<MyEmployee | null>(
    () =>
      me?.employee
        ? {
            id: me.employee.id,
            first_name: me.employee.firstName,
            last_name: me.employee.lastName,
            user_id: user?.id ?? null,
          }
        : null,
    [me, user?.id],
  );

  const ensureMyEmployee = useCallback(async () => myEmployee?.id ?? null, [myEmployee]);

  const requireEmployee = useCallback(async (): Promise<string | null | false> => {
    if (myEmployee?.id) return myEmployee.id;
    if (isAdmin) return null;
    toast.error("Vous devez avoir une fiche employé pour effectuer cette action.");
    return false;
  }, [myEmployee, isAdmin]);

  const refresh = useCallback(async () => {
    await reload();
  }, [reload]);

  return { myEmployee, isSuperAdmin: isAdmin, loading, ensureMyEmployee, requireEmployee, refresh };
}
