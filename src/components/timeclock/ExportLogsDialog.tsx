import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiErrorMessage, isApiError } from "@/lib/api/client";
import { exportTimeLogs, type ExportFormat } from "@/lib/api/timeclock";
import { Button } from "@/components/ui/button";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const MAX_EXPORT_DAYS = 366;

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/**
 * `POST /org/timeclock/logs/export` (owner and hr_admin): the API builds the file
 * in the background and e-mails a link valid 24 h. 5 exports per hour.
 */
export function ExportLogsDialog({
  defaultFrom,
  defaultTo,
  onClose,
}: {
  defaultFrom: string;
  defaultTo: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const rangeValid = !!from && !!to && from <= to && daysBetween(from, to) < MAX_EXPORT_DAYS;

  const request = useMutation({
    mutationFn: () =>
      exportTimeLogs({
        format,
        // Whole local days, from the first one's midnight to the last one's end.
        filter: {
          from: new Date(`${from}T00:00:00`).toISOString(),
          to: new Date(`${to}T23:59:59.999`).toISOString(),
        },
      }),
    onSuccess: () => {
      toast.success(t("timeclock.export.queued"));
      onClose();
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (rangeValid) request.mutate();
  };

  const error = request.error
    ? isApiError(request.error, "E_RATE_LIMITED")
      ? t("timeclock.export.tooMany")
      : apiErrorMessage(request.error)
    : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("timeclock.export.title")}</DialogTitle>
          <DialogDescription>{t("timeclock.export.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={onSubmit} className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("timeclock.export.format")}</legend>
              <RadioGroup
                value={format}
                onValueChange={(v) => setFormat(v as ExportFormat)}
                className="flex gap-6"
              >
                {(["xlsx", "csv"] as const).map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <RadioGroupItem id={`export-${f}`} value={f} />
                    <Label htmlFor={`export-${f}`}>{t(`timeclock.export.formats.${f}`)}</Label>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="export-from">{t("timeclock.logs.from")}</Label>
                <Input
                  id="export-from"
                  type="date"
                  required
                  max={to}
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="export-to">{t("timeclock.logs.to")}</Label>
                <Input
                  id="export-to"
                  type="date"
                  required
                  min={from}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>
            {!rangeValid && (
              <p className="text-sm text-destructive">
                {t("timeclock.logs.rangeError", { max: MAX_EXPORT_DAYS })}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogActions>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("timeclock.export.cancel")}
              </Button>
              <Button type="submit" disabled={!rangeValid || request.isPending}>
                {request.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("timeclock.export.submit")}
              </Button>
            </DialogActions>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
