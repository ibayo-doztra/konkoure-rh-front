import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShieldCheck, UserCheck, UserCog, UserX, Users2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage, isApiError } from "@/lib/api/client";
import {
  banUser,
  grantPlatformAdmin,
  impersonateUser,
  isRootOnly,
  platformAdminsQuery,
  platformKey,
  platformUsersQuery,
  revokePlatformAdmin,
  unbanUser,
  updateUserRoles,
  type PlatformAdmin,
  type PlatformUser,
} from "@/lib/api/platform";
import type { PlatformLevel } from "@/lib/api/types";
import { useAuth } from "@/hooks/useAuth";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { ListPager, useClampedPage } from "@/components/ListPager";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionMenu } from "@/components/ActionMenu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const ROLES = Object.keys(ROLE_LABELS) as AppRole[];
const LEVEL_LABELS: Record<PlatformLevel, string> = { root: "Root", support: "Support" };

/** Messages of the documented refusals (06 §13); the rest comes from the API. */
function accountError(error: unknown) {
  if (isRootOnly(error)) return "Action réservée aux administrateurs root.";
  if (isApiError(error, "E_CONFLICT")) {
    const rule = error.details[0]?.rule;
    if (rule === "self") return "Vous ne pouvez pas faire cette action sur votre propre compte.";
    if (rule === "platformAdmin")
      return "Impossible sur un administrateur plateforme : retirez-lui d'abord ses droits.";
    if (rule === "lastOwner")
      return "C'est le dernier propriétaire de l'organisation : nommez-en un autre d'abord.";
    if (rule === "lastRoot") return "Il doit rester au moins un administrateur root actif.";
    if (rule === "notBanned") return "Ce compte n'est pas banni.";
    if (rule === "banned") return "Ce compte est banni.";
  }
  if (isApiError(error, "E_VALIDATION") && error.details[0]?.field === "email")
    return "Aucun compte actif ne correspond à cette adresse.";
  return apiErrorMessage(error);
}

type Action =
  | { type: "ban" | "impersonate"; user: PlatformUser }
  | { type: "unban"; user: PlatformUser }
  | { type: "roles"; user: PlatformUser }
  | null;

function AdminUsersPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { impersonate } = useAuth();
  const { canWrite } = usePlatformAdmin();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<Action>(null);

  const users = useQuery(platformUsersQuery(page, search.trim()));
  const rows = users.data?.data ?? [];
  const lastPage = users.data?.meta.lastPage ?? 1;
  useClampedPage(lastPage, page, setPage);

  const refresh = () => qc.invalidateQueries({ queryKey: [...platformKey, "users"] });
  const close = () => setAction(null);

  const ban = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => banUser(id, reason),
    onSuccess: async () => {
      toast.success("Compte banni : toutes ses sessions sont fermées.");
      close();
      await refresh();
    },
    onError: (e) => toast.error(accountError(e)),
  });

  const unban = useMutation({
    mutationFn: (id: string) => unbanUser(id),
    onSuccess: async () => {
      toast.success("Compte réactivé");
      close();
      await refresh();
    },
    onError: (e) => {
      close();
      toast.error(accountError(e));
    },
  });

  const startImpersonation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => impersonateUser(id, reason),
    onSuccess: async (result) => {
      close();
      await impersonate(result.accessToken);
      nav({ to: "/app" });
    },
    onError: (e) => toast.error(accountError(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Utilisateurs" description="Comptes, rôles et administrateurs plateforme" />

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher par e-mail ou nom…"
              aria-label="Rechercher un utilisateur"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {users.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(users.error)}</p>
      ) : users.isPending ? (
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
                      <p className="truncate text-xs font-normal text-muted-foreground">
                        {u.email}
                      </p>
                    </div>
                  ),
                },
                {
                  key: "roles",
                  header: "Organisations",
                  cell: (u) => (
                    <div className="flex flex-wrap gap-1">
                      {u.organizations.length === 0 && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {u.organizations.flatMap((o) =>
                        o.roles.map((r) => (
                          <Badge
                            key={`${o.organizationId}-${r}`}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {ROLE_LABELS[r] ?? r} · {o.organizationName}
                          </Badge>
                        )),
                      )}
                    </div>
                  ),
                },
                {
                  key: "lastLogin",
                  header: "Dernière connexion",
                  className: "text-sm",
                  cell: (u) => formatDateTime(u.lastLoginAt),
                },
                {
                  key: "state",
                  header: "État",
                  cell: (u) => (
                    <div className="flex flex-wrap gap-1" data-testid={`user-state-${u.email}`}>
                      {u.isActive ? (
                        <Badge variant="outline">Actif</Badge>
                      ) : (
                        <Badge variant="destructive">Banni</Badge>
                      )}
                      {u.platformLevel && <Badge>{LEVEL_LABELS[u.platformLevel]}</Badge>}
                    </div>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  priority: "actions",
                  align: "right",
                  cell: (u) =>
                    canWrite ? (
                      <div className="flex justify-end">
                        <ActionMenu
                          label={`Actions pour ${u.email}`}
                          items={[
                            {
                              label: "Modifier les rôles",
                              icon: <Users2 className="h-4 w-4" />,
                              disabled: u.organizations.length === 0,
                              onSelect: () => setAction({ type: "roles", user: u }),
                            },
                            {
                              label: "Se connecter en tant que",
                              icon: <UserCog className="h-4 w-4" />,
                              disabled: !u.isActive || !!u.platformLevel,
                              onSelect: () => setAction({ type: "impersonate", user: u }),
                            },
                            { type: "separator" },
                            u.isActive
                              ? {
                                  label: "Bannir le compte",
                                  icon: <UserX className="h-4 w-4 text-destructive" />,
                                  variant: "destructive",
                                  onSelect: () => setAction({ type: "ban", user: u }),
                                }
                              : {
                                  label: "Réactiver le compte",
                                  icon: <UserCheck className="h-4 w-4" />,
                                  onSelect: () => setAction({ type: "unban", user: u }),
                                },
                          ]}
                        />
                      </div>
                    ) : null,
                },
              ]}
            />
          </CardContent>
        </Card>
      )}

      <ListPager page={page} lastPage={lastPage} onChange={setPage} />

      {canWrite && <AdminsSection />}

      <ReasonDialog
        open={action?.type === "ban" || action?.type === "impersonate"}
        user={action && action.type !== "unban" ? action.user : null}
        kind={action?.type === "impersonate" ? "impersonate" : "ban"}
        loading={ban.isPending || startImpersonation.isPending}
        onClose={close}
        onConfirm={(reason) => {
          if (!action) return;
          if (action.type === "ban") ban.mutate({ id: action.user.id, reason });
          if (action.type === "impersonate")
            startImpersonation.mutate({ id: action.user.id, reason });
        }}
      />

      <ConfirmDialog
        open={action?.type === "unban"}
        onOpenChange={(open) => !open && close()}
        title="Réactiver ce compte ?"
        subtitle={action?.user.email}
        description="La personne pourra de nouveau se connecter."
        actionLabel="Réactiver"
        loading={unban.isPending}
        onConfirm={() => action && unban.mutate(action.user.id)}
      />

      <RolesDialog
        user={action?.type === "roles" ? action.user : null}
        onClose={close}
        onSaved={refresh}
      />
    </div>
  );
}

/** Ban and impersonation always carry a reason, kept in the audit trail. */
function ReasonDialog({
  open,
  user,
  kind,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  user: PlatformUser | null;
  kind: "ban" | "impersonate";
  loading: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= 3;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason("");
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {kind === "ban" ? "Bannir ce compte ?" : "Se connecter en tant que ce compte ?"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm font-semibold">{user?.email}</p>
          <DialogDescription className="mt-2">
            {kind === "ban"
              ? "Toutes ses sessions sont fermées immédiatement et il ne peut plus se connecter."
              : "Vous agirez avec ses droits pendant 30 minutes au plus, dans cet onglet uniquement. L'action est tracée avec votre motif."}
          </DialogDescription>
          <div className="mt-4 space-y-2">
            <Label htmlFor="reason">Motif</Label>
            <Textarea
              id="reason"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogActions>
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              variant={kind === "ban" ? "destructive" : "default"}
              disabled={!valid || loading}
              onClick={() => {
                onConfirm(reason.trim());
                setReason("");
              }}
            >
              {kind === "ban" ? "Bannir" : "Se connecter"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function RolesDialog({
  user,
  onClose,
  onSaved,
}: {
  user: PlatformUser | null;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const [organizationId, setOrganizationId] = useState("");
  const [roles, setRoles] = useState<AppRole[]>([]);
  const membership =
    user?.organizations.find((o) => o.organizationId === organizationId) ??
    user?.organizations[0] ??
    null;

  const pick = (id: string) => {
    setOrganizationId(id);
    setRoles(user?.organizations.find((o) => o.organizationId === id)?.roles ?? []);
  };

  // On opening: the first organization of the account and its roles.
  useEffect(() => {
    const first = user?.organizations[0];
    setOrganizationId(first?.organizationId ?? "");
    setRoles(first?.roles ?? []);
  }, [user]);

  const save = useMutation({
    mutationFn: () => updateUserRoles(user!.id, membership!.organizationId, roles),
    onSuccess: async () => {
      toast.success(roles.length ? "Rôles mis à jour" : "Compte retiré de l'organisation");
      setOrganizationId("");
      onClose();
      await onSaved();
    },
    onError: (e) => toast.error(accountError(e)),
  });

  return (
    <Dialog
      open={!!user}
      onOpenChange={(open) => {
        if (!open) {
          setOrganizationId("");
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Rôles de {user?.email}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {membership && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="roles-org">Organisation</Label>
                <Select value={membership.organizationId} onValueChange={pick}>
                  <SelectTrigger id="roles-org">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {user!.organizations.map((o) => (
                      <SelectItem key={o.organizationId} value={o.organizationId}>
                        {o.organizationName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {ROLES.map((role) => (
                  <label
                    key={role}
                    className="flex items-center gap-2 rounded-md border p-2 text-sm"
                  >
                    <Checkbox
                      checked={roles.includes(role)}
                      onCheckedChange={(c) =>
                        setRoles(c ? [...roles, role] : roles.filter((r) => r !== role))
                      }
                    />
                    {ROLE_LABELS[role]}
                  </label>
                ))}
              </div>
              {roles.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Sans rôle, le compte est retiré de l'organisation.
                </p>
              )}
              <DialogActions>
                <Button variant="outline" onClick={onClose}>
                  Annuler
                </Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  Enregistrer
                </Button>
              </DialogActions>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/** Root only: `GET /platform/admins` answers 403 to a support admin. */
function AdminsSection() {
  const qc = useQueryClient();
  const admins = useQuery(platformAdminsQuery());
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<PlatformLevel>("support");
  const [toRevoke, setToRevoke] = useState<PlatformAdmin | null>(null);
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: [...platformKey, "admins"] }),
      qc.invalidateQueries({ queryKey: [...platformKey, "users"] }),
    ]);

  const grant = useMutation({
    mutationFn: () => grantPlatformAdmin(email.trim(), level),
    onSuccess: async () => {
      toast.success("Droits plateforme mis à jour");
      setEmail("");
      await refresh();
    },
    onError: (e) => toast.error(accountError(e)),
  });

  const revoke = useMutation({
    mutationFn: (userId: string) => revokePlatformAdmin(userId),
    onSuccess: async () => {
      toast.success("Droits plateforme retirés");
      setToRevoke(null);
      await refresh();
    },
    onError: (e) => {
      setToRevoke(null);
      toast.error(accountError(e));
    },
  });

  if (admins.isError && isRootOnly(admins.error)) return null;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Administrateurs plateforme</h2>
        </div>

        {admins.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : admins.isError ? (
          <p className="text-sm text-destructive">{apiErrorMessage(admins.error)}</p>
        ) : (
          <ul className="divide-y rounded-md border" data-testid="platform-admins">
            {admins.data.map((a) => (
              <li key={a.userId} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.fullName ?? a.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                </div>
                <Badge variant={a.level === "root" ? "default" : "secondary"}>
                  {LEVEL_LABELS[a.level]}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Retirer les droits de ${a.email}`}
                  onClick={() => setToRevoke(a)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            grant.mutate();
          }}
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="admin-email">Ajouter ou changer le niveau d'un compte</Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="adresse e-mail du compte"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Select value={level} onValueChange={(v) => setLevel(v as PlatformLevel)}>
            <SelectTrigger className="sm:w-36" aria-label="Niveau">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="support">Support</SelectItem>
              <SelectItem value="root">Root</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={!email.trim() || grant.isPending}>
            Enregistrer
          </Button>
        </form>
      </CardContent>

      <ConfirmDialog
        open={!!toRevoke}
        onOpenChange={(open) => !open && setToRevoke(null)}
        title="Retirer les droits plateforme ?"
        subtitle={toRevoke?.email ?? undefined}
        description="Le compte garde ses accès aux organisations, mais n'accède plus au back office."
        actionLabel="Retirer"
        actionVariant="destructive"
        loading={revoke.isPending}
        onConfirm={() => toRevoke && revoke.mutate(toRevoke.userId)}
      />
    </Card>
  );
}
