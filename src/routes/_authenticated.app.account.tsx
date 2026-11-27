import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useState, type FormEvent } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  changePassword,
  deleteAccount,
  requestDataExport,
  revokeSession,
  sessionsKey,
  sessionsQuery,
  updateProfile,
  type UserSession,
} from "@/lib/api/account";
import { logoutAll } from "@/lib/api/auth";
import { apiErrorMessage, isApiError } from "@/lib/api/client";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/hooks/useConfirm";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
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

export const Route = createFileRoute("/_authenticated/app/account")({
  component: AccountPage,
});

function AccountPage() {
  const { t } = useTranslation();
  // An admin acting as this account must not export or delete it (06 §2).
  const { me } = useAuth();
  const impersonated = !!me?.impersonation;
  return (
    <div className="space-y-6">
      <PageHeader title={t("accountPage.title")} description={t("accountPage.description")} />
      <ProfileCard />
      <PasswordCard />
      <Suspense
        fallback={
          <Card>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        }
      >
        <SessionsCard impersonated={impersonated} />
      </Suspense>
      {!impersonated && (
        <>
          <ExportCard />
          <DeleteAccountCard />
        </>
      )}
    </div>
  );
}

function ProfileCard() {
  const { t, i18n } = useTranslation();
  const { user, reload } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [language, setLanguage] = useState<"fr" | "en">(
    user?.preferredLanguage ?? (i18n.resolvedLanguage === "en" ? "en" : "fr"),
  );

  const save = useMutation({
    mutationFn: () => updateProfile({ fullName: fullName.trim(), preferredLanguage: language }),
    onSuccess: async () => {
      await reload();
      await i18n.changeLanguage(language);
      toast.success(t("accountPage.profileSaved"));
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <h2 className="font-semibold">{t("accountPage.profileTitle")}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="account-name">{t("accountPage.fullName")}</Label>
              <Input
                id="account-name"
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-email">{t("accountPage.email")}</Label>
              <Input id="account-email" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-language">{t("accountPage.language")}</Label>
              <Select value={language} onValueChange={(value) => setLanguage(value as "fr" | "en")}>
                <SelectTrigger id="account-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("accountPage.saveProfile")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const save = useMutation({
    mutationFn: () =>
      changePassword({ currentPassword, password, password_confirmation: confirmation }),
    onSuccess: async () => {
      setCurrentPassword("");
      setPassword("");
      setConfirmation("");
      toast.success(t("accountPage.passwordChanged"));
      // The API closes every other session at this point.
      await queryClient.invalidateQueries({ queryKey: sessionsKey });
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) {
      toast.error(t("auth.passwordMismatch"));
      return;
    }
    save.mutate();
  };

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <h2 className="font-semibold">{t("accountPage.passwordTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("accountPage.passwordHint")}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t("accountPage.currentPassword")}</Label>
              <Input
                id="current-password"
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t("auth.newPassword")}</Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t("auth.confirmPassword")}</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                maxLength={128}
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("accountPage.changePassword")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SessionsCard({ impersonated }: { impersonated: boolean }) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const { data: sessions } = useSuspenseQuery(sessionsQuery());

  const revoke = useMutation({
    mutationFn: (session: UserSession) => revokeSession(session.id),
    onSuccess: () => {
      toast.success(t("accountPage.sessionRevoked"));
      return queryClient.invalidateQueries({ queryKey: sessionsKey });
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const closeAll = useMutation({
    mutationFn: logoutAll,
    onSuccess: async () => {
      toast.success(t("accountPage.logoutAllDone"));
      // This session is revoked too: only the local state is left to clear.
      await signOut();
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const onCloseAll = async () => {
    const confirmed = await confirm({
      title: t("accountPage.logoutAllTitle"),
      description: t("accountPage.logoutAllDescription"),
      actionLabel: t("accountPage.logoutAll"),
      actionVariant: "destructive",
    });
    if (confirmed) closeAll.mutate();
  };

  const label = (session: UserSession) =>
    session.deviceLabel ?? session.userAgent ?? t("accountPage.unknownDevice");

  const onRevoke = async (session: UserSession) => {
    const confirmed = await confirm({
      title: t("accountPage.revokeTitle"),
      subtitle: label(session),
      description: t("accountPage.revokeDescription"),
      actionLabel: t("accountPage.revoke"),
      actionVariant: "destructive",
    });
    if (confirmed) revoke.mutate(session);
  };

  return (
    <Card>
      {confirmDialog}
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold">{t("accountPage.sessionsTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("accountPage.sessionsHint")}</p>
          </div>
          {/* Refused while an admin acts as this account (06 §13). */}
          {!impersonated && (
            <Button
              size="sm"
              variant="outline"
              className="w-fit shrink-0"
              disabled={closeAll.isPending}
              onClick={() => void onCloseAll()}
            >
              {closeAll.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("accountPage.logoutAll")}
            </Button>
          )}
        </div>
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{label(session)}</p>
                <p className="text-xs text-muted-foreground">
                  {[session.ip, formatDateTime(session.lastActivityAt ?? session.startedAt)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {session.current ? (
                <Badge variant="secondary" className="w-fit shrink-0">
                  {t("accountPage.currentSession")}
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={revoke.isPending}
                  onClick={() => void onRevoke(session)}
                >
                  {t("accountPage.revoke")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ExportCard() {
  const { t } = useTranslation();
  const request = useMutation({
    mutationFn: requestDataExport,
    onSuccess: () => toast.success(t("accountPage.exportQueued")),
    onError: (error) =>
      toast.error(
        isApiError(error, "E_RATE_LIMITED")
          ? t("accountPage.exportTooSoon")
          : apiErrorMessage(error),
      ),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">{t("accountPage.exportTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("accountPage.exportHint")}</p>
        </div>
        <Button
          variant="outline"
          className="shrink-0"
          disabled={request.isPending}
          onClick={() => request.mutate()}
        >
          {request.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("accountPage.exportAction")}
        </Button>
      </CardContent>
    </Card>
  );
}

function DeleteAccountCard() {
  const { t } = useTranslation();
  const { me, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");

  const remove = useMutation({
    mutationFn: () => deleteAccount(password),
    onSuccess: async () => {
      setOpen(false);
      toast.success(t("accountPage.deleted"));
      // Every session is already revoked: this only clears the local one.
      await signOut();
    },
  });

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setPassword("");
      remove.reset();
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    remove.mutate();
  };

  const error = remove.error;
  const conflict = isApiError(error, "E_CONFLICT") ? error.details : [];
  const lastOwnerOf = conflict
    .filter((d) => d.rule === "lastOwner" && d.field.startsWith("organizations."))
    .map((d) => {
      const id = d.field.slice("organizations.".length);
      return me?.organizations.find((o) => o.id === id)?.name ?? id;
    });
  const lastRoot = conflict.some((d) => d.rule === "lastRoot");
  const wrongPassword =
    isApiError(error) && error.status === 422 && error.details.some((d) => d.field === "password");
  const otherError = error && !conflict.length && !wrongPassword ? apiErrorMessage(error) : null;

  return (
    <Card className="border-destructive/40">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-destructive">{t("accountPage.deleteTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("accountPage.deleteHint")}</p>
        </div>
        <Button variant="destructive" className="shrink-0" onClick={() => setOpen(true)}>
          {t("accountPage.deleteAction")}
        </Button>
      </CardContent>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("accountPage.deleteDialogTitle")}</DialogTitle>
            <DialogDescription>{t("accountPage.deleteDialogDescription")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="delete-password">{t("accountPage.deletePassword")}</Label>
                <Input
                  id="delete-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  aria-invalid={wrongPassword || undefined}
                  onChange={(event) => setPassword(event.target.value)}
                />
                {wrongPassword && (
                  <p className="text-sm text-destructive">{t("accountPage.deleteWrongPassword")}</p>
                )}
              </div>
              {lastOwnerOf.length > 0 && (
                <div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm">
                  <p>{t("accountPage.deleteLastOwner")}</p>
                  <ul className="mt-2 list-disc pl-5">
                    {lastOwnerOf.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {lastRoot && (
                <p role="alert" className="text-sm text-destructive">
                  {t("accountPage.deleteLastRoot")}
                </p>
              )}
              {otherError && (
                <p role="alert" className="text-sm text-destructive">
                  {otherError}
                </p>
              )}
              <DialogActions>
                <Button type="button" variant="outline" onClick={() => close(false)}>
                  {t("accountPage.deleteCancel")}
                </Button>
                <Button type="submit" variant="destructive" disabled={remove.isPending}>
                  {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("accountPage.deleteConfirm")}
                </Button>
              </DialogActions>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
