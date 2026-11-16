import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogActions,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Nom de l'élément concerné, affiché en évidence sous le titre. */
  subtitle?: string;
  description?: string;
  actionLabel: string;
  cancelLabel?: string;
  actionVariant?: "default" | "destructive";
  onConfirm: () => void;
  loading?: boolean;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  description,
  actionLabel,
  cancelLabel,
  actionVariant = "default",
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {subtitle && (
            <p className="text-sm font-semibold text-foreground">{subtitle}</p>
          )}
          {description && (
            <DialogDescription className={subtitle ? "mt-2" : undefined}>
              {description}
            </DialogDescription>
          )}
          <DialogActions>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {cancelLabel ?? t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant={actionVariant}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {actionLabel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
