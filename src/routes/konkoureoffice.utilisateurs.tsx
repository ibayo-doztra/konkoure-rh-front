import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Search, ShieldCheck, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import {
  searchAdminUsers,
  sendAdminPasswordReset,
  setAdminUserBanned,
  setPlatformAdmin,
} from "@/lib/api/legacy-functions";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionMenu } from "@/components/ActionMenu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/konkoureoffice/utilisateurs")({
  component: AdminUsersPage,
  head: () => ({
    meta: [
      { title: "Utilisateurs — Administration Konkouré" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type ConfirmState =
  | { type: "reset"; userId: string; email: string | null }
  | { type: "grant"; userId: string; active: boolean; email: string | null }
  | { type: "ban"; userId: string; banned: boolean; email: string | null }
  | null;

function AdminUsersPage() {
  const qc = useQueryClient();
  const searchFn = searchAdminUsers;
  const resetFn = sendAdminPasswordReset;
  const banFn = setAdminUserBanned;
  const adminFn = setPlatformAdmin;

  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => searchFn({ data: { search: search || undefined, limit: 100 } }),
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin-users"] });
  const onError = (e: any) => toast.error(e?.message ?? "Erreur");

  const reset = useMutation({
    mutationFn: (userId: string) => resetFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("E-mail de réinitialisation envoyé");
      setConfirm(null);
    },
    onError,
  });
  const ban = useMutation({
    mutationFn: (v: { userId: string; banned: boolean }) => banFn({ data: v }),
    onSuccess: () => {
      toast.success("Compte mis à jour");
      refresh();
      setConfirm(null);
    },
    onError,
  });
  const grant = useMutation({
    mutationFn: (v: { userId: string; active: boolean }) =>
      adminFn({ data: { userId: v.userId, level: "root", active: v.active } as any }),
    onSuccess: () => {
      toast.success("Droits plateforme mis à jour");
      refresh();
      setConfirm(null);
    },
    onError,
  });

  const rows: any[] = data ?? [];

  const confirmDialog = confirm ? (() => {
    if (confirm.type === "reset") {
      return {
        title: "Réinitialiser le mot de passe",
        description: `Un e-mail de réinitialisation va être envoyé à ${confirm.email ?? "cet utilisateur"}. Cette action est immédiate.`,
        actionLabel: "Envoyer l'e-mail",
        actionVariant: "default" as const,
        onConfirm: () => reset.mutate(confirm.userId),
        loading: reset.isPending,
      };
    }
    if (confirm.type === "grant") {
      return {
        title: confirm.active ? "Donner les droits super-admin" : "Retirer les droits super-admin",
        description: confirm.active
          ? `Cet utilisateur (${confirm.email ?? "-"}) obtiendra les droits super-administrateur (root) sur toute la plateforme. Confirmez-vous ?`
          : `Cet utilisateur (${confirm.email ?? "-"}) perdra les droits super-administrateur. Confirmez-vous ?`,
        actionLabel: confirm.active ? "Donner les droits" : "Retirer les droits",
        actionVariant: confirm.active ? ("default" as const) : ("destructive" as const),
        onConfirm: () => grant.mutate({ userId: confirm.userId, active: confirm.active }),
        loading: grant.isPending,
      };
    }
    return {
      title: confirm.banned ? "Désactiver le compte" : "Réactiver le compte",
      description: confirm.banned
        ? `Le compte de ${confirm.email ?? "cet utilisateur"} va être désactivé. Il ne pourra plus se connecter ni accéder à la plateforme. Confirmez-vous ?`
        : `Le compte de ${confirm.email ?? "cet utilisateur"} va être réactivé. Il pourra à nouveau se connecter. Confirmez-vous ?`,
      actionLabel: confirm.banned ? "Désactiver" : "Réactiver",
      actionVariant: "destructive" as const,
      onConfirm: () => ban.mutate({ userId: confirm.userId, banned: confirm.banned }),
      loading: ban.isPending,
    };
  })() : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Utilisateurs" description="Comptes, rôles et droits super-administrateur" />

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par e-mail…"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun utilisateur" hint="Affinez la recherche." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ResponsiveTable
              data={rows}
              getRowKey={(u) => u.id}
              empty="Aucun utilisateur"
              columns={[
                {
                  key: "user",
                  header: "Utilisateur",
                  priority: "primary",
                  cell: (u) => (
                    <div className="min-w-0">
                      <p className="truncate font-medium">{u.fullName || u.email}</p>
                      <p className="truncate text-xs font-normal text-muted-foreground">{u.email}</p>
                    </div>
                  ),
                },
                {
                  key: "roles",
                  header: "Rôles",
                  cell: (u) => (
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      {u.roles.map((r: any, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">
                          {ROLE_LABELS[r.role as AppRole] ?? r.role} · {r.organizationName}
                        </Badge>
                      ))}
                    </div>
                  ),
                },
                {
                  key: "lastSignIn",
                  header: "Dernière connexion",
                  className: "text-sm",
                  cell: (u) => formatDateTime(u.lastSignInAt),
                },
                {
                  key: "state",
                  header: "État",
                  cell: (u) => (
                    <div className="flex flex-wrap gap-1">
                      {u.banned ? (
                        <Badge variant="destructive">Désactivé</Badge>
                      ) : (
                        <Badge variant="outline">Actif</Badge>
                      )}
                      {u.platformAdmin?.is_active && <Badge>Super-admin</Badge>}
                    </div>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  priority: "actions",
                  align: "right",
                  cell: (u) => (
                    <div className="flex justify-end">
                      <ActionMenu
                        items={[
                          {
                            label: "Réinitialiser le mot de passe",
                            icon: <KeyRound className="h-4 w-4" />,
                            onSelect: () => setConfirm({ type: "reset", userId: u.id, email: u.email }),
                          },
                          {
                            label: u.platformAdmin?.is_active
                              ? "Retirer les droits super-admin"
                              : "Donner les droits super-admin",
                            icon: <ShieldCheck className="h-4 w-4" />,
                            onSelect: () =>
                              setConfirm({
                                type: "grant",
                                userId: u.id,
                                active: !u.platformAdmin?.is_active,
                                email: u.email,
                              }),
                          },
                          { type: "separator" },
                          {
                            label: u.banned ? "Réactiver le compte" : "Désactiver le compte",
                            icon: u.banned ? (
                              <UserCheck className="h-4 w-4" />
                            ) : (
                              <UserX className="h-4 w-4 text-destructive" />
                            ),
                            variant: u.banned ? "default" : "destructive",
                            onSelect: () =>
                              setConfirm({
                                type: "ban",
                                userId: u.id,
                                banned: !u.banned,
                                email: u.email,
                              }),
                          },
                        ]}
                      />
                    </div>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {confirmDialog && (
        <ConfirmDialog
          open={!!confirm}
          onOpenChange={(open) => !open && setConfirm(null)}
          title={confirmDialog.title}
          description={confirmDialog.description}
          actionLabel={confirmDialog.actionLabel}
          actionVariant={confirmDialog.actionVariant}
          onConfirm={confirmDialog.onConfirm}
          loading={confirmDialog.loading}
        />
      )}
    </div>
  );
}
