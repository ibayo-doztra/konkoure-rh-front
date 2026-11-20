import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Mail, Pencil, Send } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage, isApiError } from "@/lib/api/client";
import {
  departmentsQuery,
  eligibleManagersQuery,
  employeeQuery,
  hrKey,
  updateEmployee,
  type EmergencyContact,
  type Employee,
  type EmployeeInput,
} from "@/lib/api/hr";
import { formatDate, formatDateLong } from "@/lib/format";
import { formatEmployeeLabel } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useEmployeeInvitation } from "@/hooks/useEmployeeInvitation";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { useSubscription } from "@/hooks/useSubscription";
import { NfcBadgeCard } from "@/components/employees/NfcBadgeCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
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
import { LeaveBalanceCard } from "@/components/employees/LeaveBalanceCard";

export const Route = createFileRoute("/_authenticated/app/employees/$id")({
  component: EmployeeDetailPage,
});

const NONE = "__none__";

/** The API rejects empty strings inside objects: unset keys are simply left out. */
function withoutEmptyValues<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, text]) => [key, typeof text === "string" ? text.trim() : text])
      .filter(([, text]) => text),
  ) as T;
}

function SectionCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-[10px] border border-border bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={t("employee.editSection", { section: title })}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition hover:bg-primary/20"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-foreground">{label}</div>
      <div className="break-words text-sm text-muted-foreground">{value || "—"}</div>
    </div>
  );
}

function EmployeeDetailPage() {
  const { id } = useParams({ from: "/_authenticated/app/employees/$id" });
  const { t } = useTranslation();
  const { org } = useOrg();
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { hasModule } = useSubscription();
  const queryClient = useQueryClient();
  const organizationId = org?.id ?? "";
  const [dialog, setDialog] = useState<"personal" | "emergency" | null>(null);

  const employeeResult = useQuery({ ...employeeQuery(organizationId, id), enabled: !!org });
  const emp = employeeResult.data;
  const departments = useQuery({ ...departmentsQuery(organizationId), enabled: !!org });
  // A reader may not be allowed to open their manager's record: the name then stays empty.
  const manager = useQuery({
    ...employeeQuery(organizationId, emp?.managerId ?? ""),
    enabled: !!org && !!emp?.managerId,
  });
  const { pendingByEmployee, invite, invitingId } = useEmployeeInvitation(organizationId, isAdmin);

  const save = useMutation({
    mutationFn: (input: EmployeeInput) => updateEmployee(id, input),
    onSuccess: async () => {
      toast.success(t("employee.saved"));
      setDialog(null);
      await queryClient.invalidateQueries({ queryKey: hrKey(organizationId) });
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  if (employeeResult.isLoading) {
    return <div className="p-8 text-muted-foreground">{t("employee.loading")}</div>;
  }
  if (!emp) {
    const notFound =
      !employeeResult.error ||
      isApiError(employeeResult.error, "E_NOT_FOUND") ||
      isApiError(employeeResult.error, "E_FORBIDDEN");
    return (
      <div className="p-8 text-muted-foreground">
        {notFound ? t("employee.notFound") : apiErrorMessage(employeeResult.error)}
      </div>
    );
  }

  const isSelf = !!emp.userId && emp.userId === user?.id;
  const department = departments.data?.find((d) => d.id === emp.departmentId);
  const managerName = manager.data ? `${manager.data.firstName} ${manager.data.lastName}` : null;
  const address = [emp.address?.line1, emp.address?.city].filter(Boolean).join(", ");
  const contact = emp.emergencyContact;

  return (
    <div className="-m-4 min-h-screen bg-background p-4 md:-m-6 md:p-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title={t("employee.personal")}
          onEdit={isAdmin ? () => setDialog("personal") : undefined}
        >
          <div className="flex gap-5">
            <Avatar className="h-24 w-24 shrink-0 bg-warning ring-2 ring-border ring-offset-2 ring-offset-background">
              {emp.photoUrl && <AvatarImage src={emp.photoUrl} className="object-cover" />}
              <AvatarFallback className="bg-warning text-2xl font-semibold text-warning-foreground">
                {emp.firstName[0]}
                {emp.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-2xl font-semibold text-card-foreground">
                {emp.firstName} {emp.lastName}
              </h1>
              <p className="font-semibold text-foreground">{emp.jobTitle || "—"}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("employee.dateOfJoin")} : {formatDate(emp.hireDate)}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("employee.manager")} : {managerName ?? "—"}
              </p>

              {!isSelf && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {emp.email && (
                    <Button asChild className="bg-primary hover:bg-primary/90">
                      <a href={`mailto:${emp.email}`}>
                        <Mail className="mr-2 h-4 w-4" /> {t("employee.sendMessage")}
                      </a>
                    </Button>
                  )}
                  {isAdmin && !emp.userId && emp.email && (
                    <Button
                      variant="outline"
                      disabled={invitingId === emp.id}
                      onClick={() => invite(emp)}
                    >
                      {invitingId === emp.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {pendingByEmployee.has(emp.id)
                        ? t("employees.resendInvite")
                        : t("employees.inviteJoin")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label={`${t("employee.phone")} :`} value={emp.phone} />
            <Field label={`${t("employee.email")} :`} value={emp.email} />
            <Field label={`${t("employee.department")} :`} value={department?.name} />
            <Field label={`${t("employee.birthday")} :`} value={formatDateLong(emp.birthDate)} />
            <div className="sm:col-span-2">
              <Field label={`${t("employee.address")} :`} value={address} />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title={t("employee.emergency")}
          onEdit={isAdmin ? () => setDialog("emergency") : undefined}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`${t("employee.name")} :`} value={contact?.name} />
            <Field label={`${t("employee.relationship")} :`} value={contact?.relation} />
            <Field label={`${t("employee.phone")} :`} value={contact?.phone} />
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <LeaveBalanceCard balance={emp.leaveBalance ?? null} />
        {isAdmin && hasModule("timeclock") && (
          <NfcBadgeCard organizationId={organizationId} employeeId={emp.id} />
        )}
      </div>

      {isAdmin && (
        <>
          <PersonalDialog
            open={dialog === "personal"}
            onClose={() => setDialog(null)}
            emp={emp}
            saving={save.isPending}
            onSave={save.mutate}
          />
          <EmergencyDialog
            open={dialog === "emergency"}
            onClose={() => setDialog(null)}
            value={contact ?? {}}
            saving={save.isPending}
            onSave={(emergencyContact) => save.mutate({ emergencyContact })}
          />
        </>
      )}
    </div>
  );
}

function DialogShell({
  open,
  onClose,
  title,
  saving,
  onSave,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  saving: boolean;
  onSave: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">{children}</div>
          <DialogActions>
            <Button variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={onSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function personalForm(emp: Employee) {
  return {
    firstName: emp.firstName,
    lastName: emp.lastName,
    email: emp.email ?? "",
    phone: emp.phone ?? "",
    jobTitle: emp.jobTitle ?? "",
    hireDate: emp.hireDate ?? "",
    birthDate: emp.birthDate ?? "",
    departmentId: emp.departmentId ?? NONE,
    managerId: emp.managerId ?? NONE,
    line1: emp.address?.line1 ?? "",
    city: emp.address?.city ?? "",
  };
}

function PersonalDialog({
  open,
  onClose,
  emp,
  saving,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  emp: Employee;
  saving: boolean;
  onSave: (input: EmployeeInput) => void;
}) {
  const { t } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const [form, setForm] = useState(() => personalForm(emp));
  useEffect(() => {
    if (open) setForm(personalForm(emp));
  }, [open, emp]);

  const departments = useQuery({ ...departmentsQuery(organizationId), enabled: open && !!org });
  const managers = useQuery({ ...eligibleManagersQuery(organizationId), enabled: open && !!org });
  const departmentNames = useMemo(
    () => new Map((departments.data ?? []).map((d) => [d.id, d.name])),
    [departments.data],
  );
  const managerOptions = (managers.data ?? []).filter((m) => m.id !== emp.id);
  // A manager who is no longer eligible stays visible until it is changed.
  const currentManagerMissing =
    !!emp.managerId && !managerOptions.some((m) => m.id === emp.managerId);

  const set = (key: keyof typeof form) => (value: string) => setForm({ ...form, [key]: value });

  const submit = () =>
    onSave({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      jobTitle: form.jobTitle.trim() || null,
      hireDate: form.hireDate || null,
      birthDate: form.birthDate || null,
      departmentId: form.departmentId === NONE ? null : form.departmentId,
      managerId: form.managerId === NONE ? null : form.managerId,
      address: withoutEmptyValues({
        ...emp.address,
        line1: form.line1,
        city: form.city,
      }),
    });

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={t("employee.personal")}
      saving={saving}
      onSave={submit}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="edit-first-name"
          label={t("employee.firstName")}
          value={form.firstName}
          onChange={set("firstName")}
        />
        <TextField
          id="edit-last-name"
          label={t("employee.lastName")}
          value={form.lastName}
          onChange={set("lastName")}
        />
        <TextField
          id="edit-email"
          type="email"
          label={t("employee.email")}
          value={form.email}
          onChange={set("email")}
        />
        <TextField
          id="edit-phone"
          label={t("employee.phone")}
          value={form.phone}
          onChange={set("phone")}
        />
        <TextField
          id="edit-job"
          label={t("employee.jobTitle")}
          value={form.jobTitle}
          onChange={set("jobTitle")}
        />
        <TextField
          id="edit-hire-date"
          type="date"
          label={t("employee.hireDate")}
          value={form.hireDate}
          onChange={set("hireDate")}
        />
        <TextField
          id="edit-birth-date"
          type="date"
          label={t("employee.birthday")}
          value={form.birthDate}
          onChange={set("birthDate")}
        />
        <div>
          <Label htmlFor="edit-department">{t("employee.department")}</Label>
          <Select value={form.departmentId} onValueChange={set("departmentId")}>
            <SelectTrigger id="edit-department">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("departments.none")}</SelectItem>
              {(departments.data ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="edit-manager">{t("employee.manager")}</Label>
          <Select value={form.managerId} onValueChange={set("managerId")}>
            <SelectTrigger id="edit-manager">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("employee.noManager")}</SelectItem>
              {currentManagerMissing && (
                <SelectItem value={emp.managerId!}>{t("employee.currentManager")}</SelectItem>
              )}
              {managerOptions.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {formatEmployeeLabel(
                    { first_name: m.firstName, last_name: m.lastName, job_title: m.jobTitle },
                    m.departmentId ? departmentNames.get(m.departmentId) : null,
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TextField
          id="edit-address"
          label={t("employee.address")}
          value={form.line1}
          onChange={set("line1")}
        />
        <TextField
          id="edit-city"
          label={t("employee.city")}
          value={form.city}
          onChange={set("city")}
        />
      </div>
    </DialogShell>
  );
}

function EmergencyDialog({
  open,
  onClose,
  value,
  saving,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  value: EmergencyContact;
  saving: boolean;
  onSave: (value: EmergencyContact) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [phone, setPhone] = useState("");
  useEffect(() => {
    if (!open) return;
    setName(value.name ?? "");
    setRelation(value.relation ?? "");
    setPhone(value.phone ?? "");
  }, [open, value]);

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={t("employee.emergency")}
      saving={saving}
      onSave={() => onSave(withoutEmptyValues({ name, relation, phone }))}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id="emergency-name" label={t("employee.name")} value={name} onChange={setName} />
        <TextField
          id="emergency-relation"
          label={t("employee.relationship")}
          value={relation}
          onChange={setRelation}
        />
        <TextField
          id="emergency-phone"
          label={t("employee.phone")}
          value={phone}
          onChange={setPhone}
        />
      </div>
    </DialogShell>
  );
}
