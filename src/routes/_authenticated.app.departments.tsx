import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { ActionMenu } from "@/components/ActionMenu";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { formatEmployeeLabel } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/app/departments")({
  component: DepartmentsPage,
});

interface Department {
  id: string;
  name: string;
  description: string | null;
  manager_id: string | null;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  department_id: string | null;
}

interface DepartmentRow extends Department {
  employee_count: number;
  manager_name: string | null;
}

function buildSchema(t: (k: string) => string) {
  return z.object({
    name: z.string().trim().min(2, t("departments.nameMinError")).max(100, t("departments.nameMaxError")),
    description: z.string().trim().max(500, t("departments.descriptionMaxError")).optional(),
  });
}

function DepartmentsPage() {
  const { t } = useTranslation();
  const schema = useMemo(() => buildSchema(t), [t]);
  const { org } = useOrg();
  const [rows, setRows] = useState<DepartmentRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [deptMap, setDeptMap] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<DepartmentRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    manager_id: "",
  });

  const load = async () => {
    if (!org) return;

    const [{ data: deps, error: depErr }, { data: emps, error: empErr }] =
      await Promise.all([
        pendingQuery("GET /org/departments"),
        pendingQuery("GET /org/employees"),
      ]);

    if (depErr) toast.error(depErr.message);
    if (empErr) toast.error(empErr.message);

    const empList = (emps ?? []) as Employee[];
    setEmployees(empList);
    const departments = (deps ?? []) as Department[];
    setDeptMap(Object.fromEntries(departments.map((d) => [d.id, d.name])));

    const counts = new Map<string, number>();
    for (const e of empList) {
      if (e.department_id)
        counts.set(e.department_id, (counts.get(e.department_id) ?? 0) + 1);
    }
    const empById = new Map(
      empList.map((e) => [e.id, `${e.first_name} ${e.last_name}`]),
    );

    setRows(
      departments.map((d) => ({
        ...d,
        employee_count: counts.get(d.id) ?? 0,
        manager_name: d.manager_id ? empById.get(d.manager_id) ?? null : null,
      })),
    );
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  const reset = () => {
    setForm({ name: "", description: "", manager_id: "" });
    setEditingId(null);
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (d: DepartmentRow) => {
    setEditingId(d.id);
    setForm({
      name: d.name,
      description: d.description ?? "",
      manager_id: d.manager_id ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!org) return;
    const parsed = schema.safeParse({
      name: form.name,
      description: form.description || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const payload = {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      manager_id: form.manager_id || null,
    };
    const { error } = editingId
      ? await pendingQuery("PATCH /org/departments")
      : await pendingQuery("POST /org/departments");
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingId ? t("departments.updated") : t("departments.added"));
    setOpen(false);
    reset();
    void load();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { error } = await pendingQuery("PATCH /org/departments");
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("departments.deleted"));
    setToDelete(null);
    void load();
  };

  return (
    <div>
      <PageHeader
        title={t("departments.title")}
        description={t("departments.description")}
        actions={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) reset();
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                {t("departments.addDepartment")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? t("departments.editDepartment") : t("departments.newDepartment")}
                </DialogTitle>
              </DialogHeader>
              <DialogBody>
                <div className="space-y-5">
                  <div>
                    <Label>{t("departments.name")} <span className="text-destructive">*</span></Label>
                    <Input
                      value={form.name}
                      maxLength={100}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder={t("departments.namePlaceholder")}
                    />
                  </div>
                  <div>
                    <Label>{t("departments.descriptionLabel")}</Label>
                    <Textarea
                      value={form.description}
                      maxLength={500}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      placeholder={t("departments.descriptionPlaceholder")}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>{t("departments.manager")}</Label>
                    <Select
                      value={form.manager_id || "none"}
                      onValueChange={(v) =>
                        setForm({ ...form, manager_id: v === "none" ? "" : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("departments.chooseManager")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("departments.none")}</SelectItem>
                        {employees.map((e) => {
                          const department = e.department_id ? deptMap[e.department_id] ?? null : null;
                          return (
                            <SelectItem key={e.id} value={e.id}>
                              {formatEmployeeLabel(e, department)}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {employees.length === 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t("departments.noEmployeesHint")}
                      </p>
                    )}
                  </div>
                  <Button onClick={save} disabled={saving} className="w-full">
                    {saving ? t("departments.saving") : t("departments.save")}
                  </Button>
                </div>
              </DialogBody>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-0">
          <ResponsiveTable
            data={rows}
            getRowKey={(d) => d.id}
            empty={t("departments.empty")}
            columns={[
              {
                key: "name",
                header: t("departments.colName"),
                priority: "primary",
                className: "max-w-[16rem] truncate font-medium",
                cell: (d) => d.name,
              },
              {
                key: "manager",
                header: t("departments.colManager"),
                className: "max-w-[14rem] truncate",
                cell: (d) =>
                  d.manager_name ?? <span className="text-muted-foreground">—</span>,
              },
              {
                key: "description",
                header: t("departments.colDescription"),
                className: "max-w-[24rem] truncate text-muted-foreground",
                cell: (d) => d.description ?? "—",
              },
              {
                key: "count",
                header: t("departments.colEmployees"),
                align: "right",
                cell: (d) => (
                  <Badge variant="secondary" className="gap-1">
                    <Users className="h-3 w-3" />
                    {d.employee_count}
                  </Badge>
                ),
              },
              {
                key: "actions",
                header: t("departments.colActions"),
                priority: "actions",
                align: "right",
                cell: (d) => (
                  <div className="flex justify-end">
                    <ActionMenu
                      items={[
                        {
                          label: t("departments.edit"),
                          icon: <Pencil className="h-4 w-4" />,
                          onSelect: () => openEdit(d),
                        },
                        { type: "separator" },
                        {
                          label: t("departments.delete"),
                          icon: <Trash2 className="h-4 w-4" />,
                          variant: "destructive",
                          onSelect: () => setToDelete(d),
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

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title={t("departments.deleteTitle")}
        subtitle={toDelete?.name}
        description={
          toDelete && toDelete.employee_count > 0
            ? t("departments.deleteWithEmployees", { count: toDelete.employee_count })
            : t("departments.deleteReversible")
        }
        cancelLabel={t("departments.cancel")}
        actionLabel={t("departments.delete")}
        actionVariant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
