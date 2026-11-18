import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resendVerification } from "@/lib/api/auth";
import { authErrorKey } from "@/lib/i18n";

/** Sends a new verification e-mail to the signed-in user (limited to 3 per 24 h by the API). */
export function ResendVerificationButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);

  const resend = async () => {
    setSending(true);
    try {
      await resendVerification();
      toast.success(t("auth.verificationSent"));
    } catch (error) {
      toast.error(t(authErrorKey(error)));
    } finally {
      setSending(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      disabled={sending}
      onClick={resend}
    >
      {t("auth.resendVerification")}
    </Button>
  );
}
