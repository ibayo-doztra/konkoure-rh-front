import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiErrorMessage, newIdempotencyKey } from "@/lib/api/client";
import type { Employee } from "@/lib/api/hr";
import {
  allPendingInvitationsQuery,
  createInvitation,
  invitationsKey,
  resendInvitation,
} from "@/lib/api/organization";

/** Invites an employee to create their account, or sends the pending invitation again. */
export function useEmployeeInvitation(organizationId: string, enabled: boolean) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = useQuery({ ...allPendingInvitationsQuery(organizationId), enabled });

  const pendingByEmployee = useMemo(
    () =>
      new Map(
        (data ?? []).flatMap((invitation) =>
          invitation.employeeId ? [[invitation.employeeId, invitation] as const] : [],
        ),
      ),
    [data],
  );

  const mutation = useMutation({
    mutationFn: async (employee: Employee) => {
      const pending = pendingByEmployee.get(employee.id);
      if (pending) return { invitation: await resendInvitation(pending.id), resent: true };
      const invitation = await createInvitation(
        { email: employee.email!, role: "employee", employeeId: employee.id },
        newIdempotencyKey(),
      );
      return { invitation, resent: false };
    },
    onSuccess: ({ invitation, resent }) => {
      toast.success(
        t(resent ? "employees.invitedNew" : "employees.invitedSent", { email: invitation.email }),
      );
      return queryClient.invalidateQueries({ queryKey: invitationsKey(organizationId) });
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  return {
    pendingByEmployee,
    invite: mutation.mutate,
    invitingId: mutation.isPending ? mutation.variables?.id : undefined,
  };
}
