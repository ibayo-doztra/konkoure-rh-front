import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { importEmployees } from "@/lib/api/legacy-functions";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { downloadTemplate, parseWorkbook, type DeptOption, type ParsedRow, IMPORT_MAX_ROWS } from "@/lib/employee-import";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  orgName?: string;
  departments: DeptOption[];
  existingEmails: string[];
  onImported: () => void;
}

export function EmployeeImportDialog({ open, onOpenChange, orgId, orgName, departments, existingEmails, onImported }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  const validRows = rows?.filter((r) => r.valid) ?? [];
  const invalidCount = (rows?.length ?? 0) - validRows.length;

  const reset = () => {
    setRows(null);
    setFileName(null);
    setTruncated(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    if (!/\.xlsx$/i.test(file.name)) {
      toast.error(t("employees.import.unsupportedFormat"));
      return;
    }
    setParsing(true);
    try {
      const res = await parseWorkbook(file, { departments, existingEmails });
      setRows(res.rows);
      setTruncated(res.truncated);
      setFileName(file.name);
      if (res.rows.length === 0) toast.error(t("employees.import.emptyFile"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("employees.import.unreadableFile"));
      reset();
    } finally {
      setParsing(false);
    }
  };

  const doImport = importEmployees;

  const runImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const res = await doImport({
        data: { organizationId: orgId, rows: validRows.map((r) => r.payload!) },
      });
      if (res.error) {
        toast.error(
          t("employees.import.interrupted", {
            atLine: res.failedAt ? t("employees.import.atLine", { line: validRows[res.failedAt - 1]?.line ?? res.failedAt }) : "",
            error: res.error,
          }),
        );
      }
      if (res.inserted > 0) {
        toast.success(
          t("employees.import.importedCount", {
            count: res.inserted,
            ignored: invalidCount > 0 ? t("employees.import.ignoredCount", { count: invalidCount }) : "",
          }),
        );
        onImported();
        onOpenChange(false);
        reset();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("employees.import.importImpossible"));
    } finally {
      setImporting(false);
    }
  };


  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("employees.import.title")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {departments.length === 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t("employees.import.noDepartmentsTitle")}</AlertTitle>
              <AlertDescription>
                {t("employees.import.noDepartmentsDesc")}
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="mb-3">
              {t("employees.import.instructions", { max: IMPORT_MAX_ROWS })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void downloadTemplate(departments, orgName)}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />{t("employees.import.downloadTemplate")}
              </Button>
              <Button size="sm" onClick={() => inputRef.current?.click()} disabled={parsing}>
                {parsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {t("employees.import.chooseFile")}
              </Button>
              {fileName && <span className="self-center text-xs">{fileName}</span>}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </div>

          {rows && rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge className="bg-success text-success-foreground">{t("employees.import.valid", { count: validRows.length })}</Badge>
                {invalidCount > 0 && <Badge variant="destructive">{t("employees.import.errorCount", { count: invalidCount })}</Badge>}
                {truncated && (
                  <span className="text-muted-foreground">
                    {t("employees.import.truncated", { max: IMPORT_MAX_ROWS })}
                  </span>
                )}
              </div>

              <div className="max-h-80 overflow-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">{t("employees.import.colLine")}</TableHead>
                      <TableHead>{t("employees.import.colEmployee")}</TableHead>
                      <TableHead>{t("employees.import.colEmail")}</TableHead>
                      <TableHead>{t("employees.import.colDepartment")}</TableHead>
                      <TableHead>{t("employees.import.colRowStatus")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.line} className={r.valid ? "bg-success/5" : "bg-destructive/5"}>
                        <TableCell className="text-muted-foreground">{r.line}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {`${r.raw["Prénom"] ?? ""} ${r.raw["Nom"] ?? ""}`.trim() || "—"}
                        </TableCell>
                        <TableCell className="max-w-[14rem] truncate">{r.raw["Email"] || "—"}</TableCell>
                        <TableCell className="max-w-[10rem] truncate">{r.raw["Département"] || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {r.valid ? (
                            <span className="text-success">{t("employees.import.readyToImport")}</span>
                          ) : (
                            <span className="text-destructive">{r.errors.join(" · ")}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={reset} disabled={importing}>
                  {t("employees.import.chooseOtherFile")}
                </Button>
                <Button onClick={() => void runImport()} disabled={validRows.length === 0 || importing}>
                  {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("employees.import.importCount", { count: validRows.length })}
                </Button>
              </div>
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
