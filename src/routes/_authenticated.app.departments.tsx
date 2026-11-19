import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { apiErrorMessage } from "@/lib/api/client";
import {
  allEmployeesQuery,
  createDepartment,
  deleteDepartment,
  departmentsQuery,
  hrKey,
  updateDepartment,
  type Department,
} from "@/lib/api/hr";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
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
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { ActionMenu } from "@/components/ActionMenu";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ResponsiveTable";
import { formatEmployeeLabel } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/departments")({
  component: DepartmentsPage,
});

interface DepartmentRow extends Department {
  employeeCount: number;
  managerName: string | null;
}

const NONE = "none";
const EMPTY_FORM = { name: "", description: "", managerId: "" };

function buildSchema(t: (k: string) => string) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(2, t("departments.nameMinError"))
      .max(100, t("departments.nameMaxError")),
    description: z.string().trim().max(500, t("departments.descriptionMaxError")),
  });
}

function DepartmentsPage() {
  const { t } = useTranslation();
  const schema = useMemo(() => buildSchema(t), [t]);
  const { org } = useOrg();
  const { isAdmin } = useRole();
  const queryClient = useQueryClient();
  const organizationId = org?.id ?? "";
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<DepartmentRow | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const departments = useQuery({ ...departmentsQuery(organizationId), enabled: !!org });
  const employees = useQuery({ ...allEmployeesQuery(organizationId), enabled: !!org });
  const employeeList = useMemo(() => employees.data ?? [], [employees.data]);

  const rows = useMemo<DepartmentRow[]>(() => {
    const counts = new Map<string, number>();
    for (const employee of employeeList) {
      if (employee.departmentId) {
        counts.set(employee.departmentId, (counts.get(employee.departmentId) ?? 0) + 1);
      }
    }
    const names = new Map(employeeList.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));
    return (departments.data ?? []).map((department) => ({
      ...department,
      employeeCount: counts.get(department.id) ?? 0,
      managerName: department.managerId ? (names.get(department.managerId) ?? null) : null,
    }));
  }, [departments.data, employeeList]);

  const departmentNames = useMemo(
    () => new Map((departments.data ?? []).map((d) => [d.id, d.name])),
    [departments.data],
  );
  // The current head stays selectable even if no longer active.
  const headOptions = employeeList.filter((e) => e.status === "active" || e.id === form.managerId);
  const reassignTargets = rows.filter((d) => d.id !== toDelete?.id);

  const refresh = () => queryClient.invalidateQueries({ queryKey: hrKey(organizationId) });

  const closeForm = () => {
    setOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (department: DepartmentRow) => {
    setEditingId(department.id);
    setForm({
      name: department.name,
      description: department.description ?? "",
      managerId: department.managerId ?? "",
    });
    setOpen(true);
  };

  const closeDelete = () => {
    setToDelete(null);
    setReassignTo("");
  };

  const save = useMutation({
    mutationFn: (input: { name: string; description: string }) => {
      const payload = {
        name: input.name,
        description: input.description || null,
        managerId: form.managerId || null,
      };
      return editingId ? updateDepartment(editingId, payload) : createDepartment(payload);
    },
    onSuccess: async () => {
      toast.success(editingId ? t("departments.updated") : t("departments.added"));
      closeForm();
      await refresh();
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (department: DepartmentRow) =>
      deleteDepartment(department.id, department.employeeCount > 0 ? reassignTo : undefined),
    onSuccess: async () => {
      toast.success(t("departments.deleted"));
      closeDelete();
      await refresh();
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const submit = () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    save.mutate(parsed.data);
  };

  const columns: ResponsiveColumn<DepartmentRow>[] = [
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
      cell: (d) => d.managerName ?? <span className="text-muted-foreground">—</span>,
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
          {d.employeeCount}
        </Badge>
      ),
    },
  ];
  if (isAdmin) {
    columns.push({
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
    });
  }

  const mustReassign = (toDelete?.employeeCount ?? 0) > 0;

  return (
    <div>
      <PageHeader
        title={t("departments.title")}
        description={t("departments.description")}
        actions={
          isAdmin ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t("departments.addDepartment")}
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="p-0">
          <ResponsiveTable
            data={rows}
            getRowKey={(d) => d.id}
            loading={departments.isLoading}
            empty={
              departments.isError ? apiErrorMessage(departments.error) : t("departments.empty")
            }
            columns={columns}
          />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(value) => !value && closeForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("departments.editDepartment") : t("departments.newDepartment")}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-5">
              <div>
                <Label htmlFor="department-name">
                  {t("departments.name")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="department-name"
                  value={form.name}
                  maxLength={100}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("departments.namePlaceholder")}
                />
              </div>
              <div>
                <Label htmlFor="department-description">{t("departments.descriptionLabel")}</Label>
                <Textarea
                  id="department-description"
                  value={form.description}
                  maxLength={500}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={t("departments.descriptionPlaceholder")}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="department-manager">{t("departments.manager")}</Label>
                <Select
                  value={form.managerId || NONE}
                  onValueChange={(v) => setForm({ ...form, managerId: v === NONE ? "" : v })}
                >
                  <SelectTrigger id="department-manager">
                    <SelectValue placeholder={t("departments.chooseManager")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("departments.none")}</SelectItem>
                    {headOptions.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {formatEmployeeLabel(
                          { first_name: e.firstName, last_name: e.lastName, job_title: e.jobTitle },
                          e.departmentId ? departmentNames.get(e.departmentId) : null,
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {headOptions.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("departments.noEmployeesHint")}
                  </p>
                )}
              </div>
              <Button onClick={submit} disabled={save.isPending} className="w-full">
                {save.isPending ? t("departments.saving") : t("departments.save")}
              </Button>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toDelete} onOpenChange={(value) => !value && closeDelete()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("departments.deleteTitle")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm font-semibold text-foreground">{toDelete?.name}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {mustReassign
                ? t(
                    reassignTargets.length > 0
                      ? "departments.deleteWithEmployees"
                      : "departments.deleteBlocked",
                    { count: toDelete?.employeeCount },
                  )
                : t("departments.deleteReversible")}
            </p>
            {mustReassign && reassignTargets.length > 0 && (
              <div className="mt-4 space-y-2">
                <Label htmlFor="department-reassign">{t("departments.reassignTo")}</Label>
                <Select value={reassignTo} onValueChange={setReassignTo}>
                  <SelectTrigger id="department-reassign">
                    <SelectValue placeholder={t("departments.chooseDepartment")} />
                  </SelectTrigger>
                  <SelectContent>
                    {reassignTargets.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogActions>
              <Button variant="outline" onClick={closeDelete}>
                {t("departments.cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={remove.isPending || (mustReassign && !reassignTo)}
                onClick={() => toDelete && remove.mutate(toDelete)}
              >
                {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("departments.delete")}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
