import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertTriangle, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage, isApiError, newIdempotencyKey } from "@/lib/api/client";
import {
  commitEmployeeImport,
  hrKey,
  previewEmployeeImport,
  type ImportAction,
  type ImportPreview,
} from "@/lib/api/hr";
import {
  downloadTemplate,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  type DeptOption,
} from "@/lib/employee-import";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  orgName?: string;
  departments: DeptOption[];
}

const ACCEPTED = /\.(xlsx|csv)$/i;

export function EmployeeImportDialog({
  open,
  onOpenChange,
  organizationId,
  orgName,
  departments,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const commitKey = useRef("");

  const reset = () => {
    setPreview(null);
    setFileName(null);
    analyse.reset();
    if (inputRef.current) inputRef.current.value = "";
  };

  const analyse = useMutation({
    mutationFn: previewEmployeeImport,
    onSuccess: (result) => {
      commitKey.current = newIdempotencyKey();
      setPreview(result);
      if (result.summary.total === 0) toast.error(t("employees.import.emptyFile"));
    },
    onError: (error) => {
      toast.error(t("employees.import.importImpossible"), {
        description: apiErrorMessage(error),
      });
      setFileName(null);
      if (inputRef.current) inputRef.current.value = "";
    },
  });

  const commit = useMutation({
    mutationFn: () => commitEmployeeImport(preview!.importToken, commitKey.current),
    onSuccess: (report) => {
      toast.success(
        t("employees.import.imported", { created: report.created, updated: report.updated }),
      );
      void queryClient.invalidateQueries({ queryKey: hrKey(organizationId) });
      onOpenChange(false);
      reset();
    },
    onError: (error) => {
      const expired = isApiError(error) && error.details.some((d) => d.rule === "expired");
      toast.error(t("employees.import.importImpossible"), {
        description: expired ? t("employees.import.expired") : apiErrorMessage(error),
      });
      if (expired) reset();
    },
  });

  const handleFile = (file: File) => {
    if (!ACCEPTED.test(file.name)) {
      toast.error(t("employees.import.unsupportedFormat"));
      return;
    }
    if (file.size > IMPORT_MAX_BYTES) {
      toast.error(t("employees.import.tooLarge"));
      return;
    }
    setFileName(file.name);
    setPreview(null);
    analyse.mutate(file);
  };

  const summary = preview?.summary;
  const hasErrors = (summary?.error ?? 0) > 0;
  const writable = (summary?.create ?? 0) + (summary?.update ?? 0) > 0;
  const actionLabel: Record<ImportAction, string> = {
    create: t("employees.import.actionCreate"),
    update: t("employees.import.actionUpdate"),
    skip: t("employees.import.actionSkip"),
    error: t("employees.import.actionError"),
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("employees.import.title")}</DialogTitle>
          <DialogDescription>
            {t("employees.import.instructions", { max: IMPORT_MAX_ROWS })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void downloadTemplate(departments, orgName)}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {t("employees.import.downloadTemplate")}
            </Button>
            <Button
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={analyse.isPending || commit.isPending}
            >
              {analyse.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {analyse.isPending
                ? t("employees.import.analysing")
                : t("employees.import.chooseFile")}
            </Button>
            {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              aria-label={t("employees.import.chooseFile")}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>

          {summary && summary.total > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge className="bg-success text-success-foreground">
                  {t("employees.import.create", { count: summary.create })}
                </Badge>
                <Badge variant="secondary">
                  {t("employees.import.update", { count: summary.update })}
                </Badge>
                {summary.skip > 0 && (
                  <Badge variant="outline">
                    {t("employees.import.skip", { count: summary.skip })}
                  </Badge>
                )}
                {hasErrors && (
                  <Badge variant="destructive">
                    {t("employees.import.errorCount", { count: summary.error })}
                  </Badge>
                )}
              </div>

              {preview.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t("employees.import.errorsTitle")}</AlertTitle>
                  <AlertDescription>
                    <p className="mb-2">{t("employees.import.errorsDesc")}</p>
                    <ul className="max-h-40 space-y-1 overflow-auto text-sm">
                      {preview.errors.map((issue, index) => (
                        <li key={`${issue.line}-${issue.field}-${index}`}>
                          {issue.line > 0 && (
                            <span className="font-medium">
                              {t("employees.import.colLine")} {issue.line}
                              {issue.field ? ` · ${issue.field}` : ""} :{" "}
                            </span>
                          )}
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="max-h-80 overflow-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">{t("employees.import.colLine")}</TableHead>
                      <TableHead>{t("employees.import.colEmployee")}</TableHead>
                      <TableHead>{t("employees.import.colAction")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row) => (
                      <TableRow
                        key={row.line}
                        className={row.action === "error" ? "bg-destructive/5" : undefined}
                      >
                        <TableCell className="text-muted-foreground">{row.line}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.name || "—"}</TableCell>
                        <TableCell
                          className={
                            row.action === "error" ? "text-destructive" : "text-muted-foreground"
                          }
                        >
                          {actionLabel[row.action]}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogActions>
                <Button variant="outline" onClick={reset} disabled={commit.isPending}>
                  {t("employees.import.chooseOtherFile")}
                </Button>
                <Button
                  onClick={() => commit.mutate()}
                  disabled={hasErrors || !writable || commit.isPending}
                >
                  {commit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("employees.import.importAction")}
                </Button>
              </DialogActions>
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
