import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Mail, Pencil, Trash2, UserPlus, X } from "lucide-react";
import { apiErrorMessage, newIdempotencyKey } from "@/lib/api/client";
import {
  createInvitation,
  invitationsKey,
  membersKey,
  membersQuery,
  pendingInvitationsQuery,
  removeMember,
  resendInvitation,
  revokeInvitation,
  updateMemberRoles,
  type Member,
} from "@/lib/api/organization";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/useConfirm";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { formatDate } from "@/lib/format";
import { ALL_ROLES, type AppRole } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogFormGrid,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/app/settings/members")({
  component: MembersPage,
});

/** Only an owner may grant the owner role; the API enforces it. */
function useAssignableRoles(): AppRole[] {
  const { roles } = useRole();
  return roles.includes("owner") ? ALL_ROLES : ALL_ROLES.filter((role) => role !== "owner");
}

function MembersPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const [inviting, setInviting] = useState(false);

  if (!org) return null;
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("membersPage.title")}
        description={t("membersPage.description")}
        actions={
          <Button onClick={() => setInviting(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            {t("membersPage.invite")}
          </Button>
        }
      />
      <Suspense fallback={<ListFallback />}>
        <MembersCard organizationId={org.id} />
      </Suspense>
      <Suspense fallback={<ListFallback />}>
        <InvitationsCard organizationId={org.id} />
      </Suspense>
      <InviteDialog organizationId={org.id} open={inviting} onOpenChange={setInviting} />
    </div>
  );
}

function ListFallback() {
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

function Pager({
  page,
  lastPage,
  onChange,
}: {
  page: number;
  lastPage: number;
  onChange: (page: number) => void;
}) {
  const { t } = useTranslation();
  if (lastPage <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 pt-2">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        {t("membersPage.previous")}
      </Button>
      <span className="text-sm text-muted-foreground">
        {page} / {lastPage}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= lastPage}
        onClick={() => onChange(page + 1)}
      >
        {t("membersPage.next")}
      </Button>
    </div>
  );
}

/** Keeps the list on an existing page after its last row was removed. */
function useClampedPage(lastPage: number, page: number, setPage: (page: number) => void) {
  useEffect(() => {
    if (page > 1 && page > lastPage) setPage(Math.max(lastPage, 1));
  }, [lastPage, page, setPage]);
}

function MembersCard({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { roles } = useRole();
  const { confirm, confirmDialog } = useConfirm();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Member | null>(null);
  const { data } = useSuspenseQuery(membersQuery(organizationId, page));
  const lastPage = data.meta.lastPage ?? 1;
  useClampedPage(lastPage, page, setPage);

  const remove = useMutation({
    mutationFn: (member: Member) => removeMember(member.userId),
    onSuccess: () => {
      toast.success(t("membersPage.removed"));
      return queryClient.invalidateQueries({ queryKey: membersKey(organizationId) });
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  // Mirrors the API rules: nobody edits themselves, only an owner touches an owner.
  const canManage = (member: Member) =>
    member.userId !== user?.id && (roles.includes("owner") || !member.roles.includes("owner"));

  const onRemove = async (member: Member) => {
    const confirmed = await confirm({
      title: t("membersPage.removeTitle"),
      subtitle: member.fullName ?? member.email,
      description: t("membersPage.removeDescription"),
      actionLabel: t("membersPage.remove"),
      actionVariant: "destructive",
    });
    if (confirmed) remove.mutate(member);
  };

  return (
    <Card className="min-w-0">
      {confirmDialog}
      <CardContent className="space-y-4 p-6">
        <h2 className="font-semibold">{t("membersPage.membersTitle")}</h2>
        <div className="min-w-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("membersPage.member")}</TableHead>
                <TableHead>{t("membersPage.roles")}</TableHead>
                <TableHead>{t("membersPage.joinedAt")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((member) => {
                const label = member.fullName ?? member.email;
                return (
                  <TableRow key={member.userId}>
                    <TableCell>
                      <div className="font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {member.roles.map((role) => (
                          <Badge key={role} variant="secondary">
                            {t(`roles.${role}`)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(member.joinedAt)}
                    </TableCell>
                    <TableCell>
                      {canManage(member) && (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={t("membersPage.editRolesOf", { name: label })}
                            onClick={() => setEditing(member)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={t("membersPage.removeNamed", { name: label })}
                            disabled={remove.isPending}
                            onClick={() => void onRemove(member)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <Pager page={page} lastPage={lastPage} onChange={setPage} />
      </CardContent>
      <RolesDialog
        key={editing?.userId ?? "none"}
        organizationId={organizationId}
        member={editing}
        onClose={() => setEditing(null)}
      />
    </Card>
  );
}

function RolesDialog({
  organizationId,
  member,
  onClose,
}: {
  organizationId: string;
  member: Member | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const assignable = useAssignableRoles();
  const [selected, setSelected] = useState<AppRole[]>(member?.roles ?? []);

  const save = useMutation({
    mutationFn: () => updateMemberRoles(member!.userId, selected),
    onSuccess: async () => {
      toast.success(t("membersPage.rolesUpdated"));
      await queryClient.invalidateQueries({ queryKey: membersKey(organizationId) });
      onClose();
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const toggle = (role: AppRole, checked: boolean) =>
    setSelected((current) =>
      checked ? [...current, role] : current.filter((value) => value !== role),
    );

  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("membersPage.editRoles")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="mb-4 text-sm font-semibold">{member?.fullName ?? member?.email}</p>
          <div className="space-y-3">
            {assignable.map((role) => (
              <div key={role} className="flex items-center gap-2">
                <Checkbox
                  id={`role-${role}`}
                  checked={selected.includes(role)}
                  onCheckedChange={(checked) => toggle(role, checked === true)}
                />
                <Label htmlFor={`role-${role}`}>{t(`roles.${role}`)}</Label>
              </div>
            ))}
          </div>
          <DialogActions>
            <Button variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={selected.length === 0 || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("membersPage.saveRoles")}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function InvitationsCard({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data } = useSuspenseQuery(pendingInvitationsQuery(organizationId, page));
  const lastPage = data.meta.lastPage ?? 1;
  useClampedPage(lastPage, page, setPage);

  const refresh = () => queryClient.invalidateQueries({ queryKey: invitationsKey(organizationId) });

  const resend = useMutation({
    mutationFn: resendInvitation,
    onSuccess: () => {
      toast.success(t("membersPage.invitationResent"));
      return refresh();
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const revoke = useMutation({
    mutationFn: revokeInvitation,
    onSuccess: () => {
      toast.success(t("membersPage.invitationRevoked"));
      return refresh();
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const onRevoke = async (id: string, email: string) => {
    const confirmed = await confirm({
      title: t("membersPage.revokeTitle"),
      subtitle: email,
      description: t("membersPage.revokeDescription"),
      actionLabel: t("membersPage.revoke"),
      actionVariant: "destructive",
    });
    if (confirmed) revoke.mutate(id);
  };

  return (
    <Card className="min-w-0">
      {confirmDialog}
      <CardContent className="space-y-4 p-6">
        <h2 className="font-semibold">{t("membersPage.invitationsTitle")}</h2>
        {data.data.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("membersPage.noInvitation")}
          </p>
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("membersPage.email")}</TableHead>
                  <TableHead>{t("membersPage.role")}</TableHead>
                  <TableHead>{t("membersPage.expiresAt")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{t(`roles.${invitation.role}`)}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(invitation.expiresAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={t("membersPage.resendTo", { email: invitation.email })}
                          disabled={resend.isPending}
                          onClick={() => resend.mutate(invitation.id)}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={t("membersPage.revokeFor", { email: invitation.email })}
                          disabled={revoke.isPending}
                          onClick={() => void onRevoke(invitation.id, invitation.email)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Pager page={page} lastPage={lastPage} onChange={setPage} />
      </CardContent>
    </Card>
  );
}

function InviteDialog({
  organizationId,
  open,
  onOpenChange,
}: {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const assignable = useAssignableRoles();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("employee");
  // One key per opening: a double submit cannot send two invitations.
  const idempotencyKey = useRef("");

  useEffect(() => {
    if (!open) return;
    idempotencyKey.current = newIdempotencyKey();
    setEmail("");
    setRole("employee");
  }, [open]);

  const send = useMutation({
    mutationFn: () => createInvitation({ email: email.trim(), role }, idempotencyKey.current),
    onSuccess: async () => {
      toast.success(t("membersPage.invitationSent"));
      await queryClient.invalidateQueries({ queryKey: invitationsKey(organizationId) });
      onOpenChange(false);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("membersPage.inviteTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={onSubmit}>
            <DialogFormGrid>
              <div className="space-y-2">
                <Label htmlFor="invite-email">{t("membersPage.email")}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  required
                  maxLength={255}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">{t("membersPage.role")}</Label>
                <Select value={role} onValueChange={(value) => setRole(value as AppRole)}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignable.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`roles.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DialogFormGrid>
            <DialogActions>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={send.isPending}>
                {send.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("membersPage.sendInvitation")}
              </Button>
            </DialogActions>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
