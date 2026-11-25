// Shown while a platform admin acts as this account (`GET /me.impersonation`).
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { UserCog } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function ImpersonationBanner() {
  const { t } = useTranslation();
  const { me, endImpersonation } = useAuth();
  const nav = useNavigate();
  const [leaving, setLeaving] = useState(false);
  if (!me?.impersonation) return null;

  const expiresAt = me.impersonation.expiresAt
    ? new Date(me.impersonation.expiresAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const leave = async () => {
    setLeaving(true);
    await endImpersonation();
    await nav({ to: "/konkoureoffice/utilisateurs" });
    toast.success(t("impersonation.ended"));
  };

  return (
    <div
      role="status"
      data-testid="impersonation-banner"
      className="flex flex-wrap items-center gap-2 border-b border-warning/40 bg-warning/15 px-4 py-2 text-sm text-foreground"
    >
      <UserCog className="h-4 w-4 shrink-0" />
      <span className="font-medium">{t("impersonation.banner", { email: me.user.email })}</span>
      {expiresAt && (
        <span className="text-muted-foreground">
          {t("impersonation.until", { time: expiresAt })}
        </span>
      )}
      <Button size="sm" variant="outline" className="ml-auto" disabled={leaving} onClick={leave}>
        {t("impersonation.leave")}
      </Button>
    </div>
  );
}
