import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { allEmployeesQuery } from "@/lib/api/hr";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";

/**
 * Mirrors the "self · M(team)" rule of 06 §9 to show or hide controls; the API
 * still decides. A manager is in charge of his direct and indirect reports.
 */
export function usePerformanceAccess() {
  const { org } = useOrg();
  const { myEmployee } = useMyEmployee();
  const { roles, isAdmin } = useRole();
  const employees = useQuery({ ...allEmployeesQuery(org?.id ?? ""), enabled: !!org });
  const me = myEmployee?.id ?? null;
  const isManager = roles.includes("manager");

  return useMemo(() => {
    const managerOf = new Map((employees.data ?? []).map((e) => [e.id, e.managerId ?? null]));
    const isSelf = (employeeId: string) => employeeId === me;
    const inMyTeam = (employeeId: string) => {
      if (!me || !isManager) return false;
      // Without HR rights, a manager only reads his team and himself.
      if (!isAdmin) return employeeId !== me;
      const seen = new Set<string>();
      for (
        let m = managerOf.get(employeeId) ?? null;
        m && !seen.has(m);
        m = managerOf.get(m) ?? null
      ) {
        if (m === me) return true;
        seen.add(m);
      }
      return false;
    };
    const nameOf = (employeeId: string) => {
      const e = (employees.data ?? []).find((x) => x.id === employeeId);
      if (e) return `${e.firstName} ${e.lastName}`;
      if (employeeId === me && myEmployee) {
        return `${myEmployee.first_name ?? ""} ${myEmployee.last_name ?? ""}`.trim() || null;
      }
      return null;
    };
    return {
      employees: employees.data ?? [],
      myEmployeeId: me,
      isAdmin,
      isManager,
      isSelf,
      inMyTeam,
      /** Holder or their manager: goal progress, key results. */
      canProgress: (employeeId: string) => isSelf(employeeId) || inMyTeam(employeeId),
      /** HR or the manager, never on one's own record: OKR validation. */
      canDecide: (employeeId: string) => !isSelf(employeeId) && (isAdmin || inMyTeam(employeeId)),
      nameOf,
    };
  }, [employees.data, me, myEmployee, isAdmin, isManager]);
}
