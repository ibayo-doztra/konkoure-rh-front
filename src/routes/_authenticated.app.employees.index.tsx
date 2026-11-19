import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Facebook, Linkedin, Youtube, Globe, Send } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { apiErrorMessage } from "@/lib/api/client";
import {
  createEmployee,
  departmentsQuery,
  eligibleManagersQuery,
  employeeHeadcountQuery,
  employeesQuery,
  hrKey,
  type Employee,
  type EmployeeStatus,
} from "@/lib/api/hr";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { useEmployeeInvitation } from "@/hooks/useEmployeeInvitation";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFormGrid,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPager, useClampedPage } from "@/components/ListPager";
import { formatEmployeeLabel } from "@/lib/utils";

const ALL = "all";
const NO_MANAGER = "__none__";
const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  jobTitle: "",
  departmentId: "",
  managerId: "",
  status: "active",
  hireDate: "",
  birthDate: "",
};

const STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: "employee.statusActive",
  on_leave: "employee.statusOnLeave",
  suspended: "employee.statusSuspended",
  terminated: "employee.statusTerminated",
};

function buildEmployeeSchema(t: (k: string) => string) {
  return z.object({
    firstName: z.string().trim().min(2, t("employee.errFirstName")).max(80),
    lastName: z.string().trim().min(2, t("employee.errLastName")).max(80),
    email: z.string().trim().email(t("employee.errEmail")).max(255),
    phone: z.string().trim().min(6, t("employee.errPhone")).max(30),
    jobTitle: z.string().trim().min(1, t("employee.errJobTitle")).max(120),
    departmentId: z.string().uuid(t("employee.errDepartment")),
    managerId: z.string().min(1, t("employee.errManager")),
    status: z.enum(["active", "on_leave", "terminated"]),
    hireDate: z.string().min(1, t("employee.errHireDate")),
    birthDate: z.string().min(1, t("employee.errBirthDate")),
  });
}

type FormErrors = Partial<Record<string, string>>;

function Req() {
  return <span className="text-destructive"> *</span>;
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-destructive">{msg}</p> : null;
}

export const Route = createFileRoute("/_authenticated/app/employees/")({
  component: EmployeesPage,
});

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2H21l-6.52 7.45L22 22h-6.78l-4.79-6.27L4.8 22H2l7.04-8.04L2 2h6.91l4.33 5.79L18.244 2zm-1.19 18h1.7L7.06 4H5.27l11.78 16z" />
    </svg>
  );
}

function SocialBtn({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={(event) => event.stopPropagation()}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/70"
      aria-hidden
    >
      {children}
    </button>
  );
}

function EmployeeAvatar({ employee }: { employee: Employee }) {
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">(
    employee.photoUrl ? "loading" : "idle",
  );
  return (
    <div className="relative h-24 w-24">
      {status === "loading" && <Skeleton className="absolute inset-0 rounded-full" />}
      <Avatar className="h-24 w-24 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
        {employee.photoUrl && (
          <AvatarImage
            src={employee.photoUrl}
            className="object-cover"
            loading="lazy"
            decoding="async"
            onLoadingStatusChange={(next) => setStatus(next)}
          />
        )}
        <AvatarFallback className="text-xl">
          {employee.firstName[0]}
          {employee.lastName[0]}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}

function EmployeesPage() {
  const { t } = useTranslation();
  const employeeSchema = useMemo(() => buildEmployeeSchema(t), [t]);
  const { org } = useOrg();
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const organizationId = org?.id ?? "";

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [departmentId, setDepartmentId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const employees = useQuery({
    ...employeesQuery(organizationId, {
      page,
      q: q || undefined,
      status: status === ALL ? undefined : (status as EmployeeStatus),
      departmentId: departmentId === ALL ? undefined : departmentId,
    }),
    enabled: !!org,
  });
  const departments = useQuery({ ...departmentsQuery(organizationId), enabled: !!org });
  const managers = useQuery({
    ...eligibleManagersQuery(organizationId),
    enabled: !!org && isAdmin && open,
  });
  const { pendingByEmployee, invite, invitingId } = useEmployeeInvitation(organizationId, isAdmin);

  const items = employees.data?.data ?? [];
  const lastPage = employees.data?.meta.lastPage ?? 1;
  useClampedPage(lastPage, page, setPage);

  const departmentNames = useMemo(
    () => new Map((departments.data ?? []).map((d) => [d.id, d.name])),
    [departments.data],
  );

  const create = useMutation({
    mutationFn: (values: z.infer<typeof employeeSchema>) =>
      createEmployee({
        ...values,
        managerId: values.managerId === NO_MANAGER ? null : values.managerId,
      }),
    onSuccess: async () => {
      toast.success(t("employee.added"));
      setOpen(false);
      setForm(EMPTY_FORM);
      await queryClient.invalidateQueries({ queryKey: hrKey(organizationId) });
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const save = () => {
    const parsed = employeeSchema.safeParse(form);
    if (!parsed.success) {
      const next: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        next[key] ??= issue.message;
      }
      setErrors(next);
      toast.error(t("employee.requiredAll"));
      return;
    }
    setErrors({});
    create.mutate(parsed.data);
  };

  const field = (key: keyof typeof EMPTY_FORM) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: event.target.value }),
  });

  const accountBadge = (employee: Employee) => {
    if (employee.userId) {
      return (
        <Badge className="bg-success text-success-foreground">{t("employees.accountActive")}</Badge>
      );
    }
    if (pendingByEmployee.has(employee.id)) {
      return <Badge variant="secondary">{t("employees.invitationSent")}</Badge>;
    }
    return <Badge variant="outline">{t("employees.noAccount")}</Badge>;
  };

  return (
    <div className="-m-6 min-h-[calc(100vh-4rem)] bg-background p-6">
      {isAdmin && org && <QuotaBanner organizationId={org.id} />}

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card">
          <CardContent className="flex h-full items-start p-6">
            <Input
              aria-label={t("employee.searchPlaceholder")}
              placeholder={t("employee.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10"
            />
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="flex h-full items-start p-6">
            <Select
              value={departmentId}
              onValueChange={(value) => {
                setDepartmentId(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10" aria-label={t("employee.department")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("employee.allDepartments")}</SelectItem>
                {(departments.data ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="flex h-full items-start p-6">
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10" aria-label={t("employee.statusLabel")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("employee.allStatuses")}</SelectItem>
                {(Object.keys(STATUS_LABELS) as EmployeeStatus[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(STATUS_LABELS[value])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        {isAdmin && (
          <Card className="bg-card">
            <CardContent className="flex h-full items-start p-6">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    {t("employee.addEmployee")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("employee.newEmployee")}</DialogTitle>
                  </DialogHeader>
                  <DialogBody>
                    <DialogFormGrid>
                      <div>
                        <Label htmlFor="employee-first-name">
                          {t("employee.firstName")}
                          <Req />
                        </Label>
                        <Input id="employee-first-name" {...field("firstName")} />
                        <FieldError msg={errors.firstName} />
                      </div>
                      <div>
                        <Label htmlFor="employee-last-name">
                          {t("employee.lastName")}
                          <Req />
                        </Label>
                        <Input id="employee-last-name" {...field("lastName")} />
                        <FieldError msg={errors.lastName} />
                      </div>
                      <div>
                        <Label htmlFor="employee-email">
                          {t("employee.email")}
                          <Req />
                        </Label>
                        <Input id="employee-email" type="email" {...field("email")} />
                        <FieldError msg={errors.email} />
                      </div>
                      <div>
                        <Label htmlFor="employee-phone">
                          {t("employee.phone")}
                          <Req />
                        </Label>
                        <Input id="employee-phone" type="tel" {...field("phone")} />
                        <FieldError msg={errors.phone} />
                      </div>
                      <div>
                        <Label htmlFor="employee-job">
                          {t("employee.jobTitle")}
                          <Req />
                        </Label>
                        <Input id="employee-job" {...field("jobTitle")} />
                        <FieldError msg={errors.jobTitle} />
                      </div>
                      <div>
                        <Label htmlFor="employee-department">
                          {t("employee.department")}
                          <Req />
                        </Label>
                        <Select
                          value={form.departmentId}
                          onValueChange={(value) => setForm({ ...form, departmentId: value })}
                        >
                          <SelectTrigger id="employee-department">
                            <SelectValue placeholder={t("employee.choose")} />
                          </SelectTrigger>
                          <SelectContent>
                            {(departments.data ?? []).map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError msg={errors.departmentId} />
                      </div>
                      <div>
                        <Label htmlFor="employee-manager">
                          {t("employee.managerN1")}
                          <Req />
                        </Label>
                        <Select
                          value={form.managerId}
                          onValueChange={(value) => setForm({ ...form, managerId: value })}
                        >
                          <SelectTrigger id="employee-manager">
                            <SelectValue placeholder={t("employee.chooseManager")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_MANAGER}>{t("employee.noManager")}</SelectItem>
                            {(managers.data ?? []).map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {formatEmployeeLabel(
                                  {
                                    first_name: m.firstName,
                                    last_name: m.lastName,
                                    job_title: m.jobTitle,
                                  },
                                  m.departmentId ? departmentNames.get(m.departmentId) : null,
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError msg={errors.managerId} />
                      </div>
                      <div>
                        <Label htmlFor="employee-status">
                          {t("employee.statusLabel")}
                          <Req />
                        </Label>
                        <Select
                          value={form.status}
                          onValueChange={(value) => setForm({ ...form, status: value })}
                        >
                          <SelectTrigger id="employee-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">{t("employee.statusActive")}</SelectItem>
                            <SelectItem value="on_leave">{t("employee.statusOnLeave")}</SelectItem>
                            <SelectItem value="terminated">
                              {t("employee.statusTerminated")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="employee-hire-date">
                          {t("employee.hireDate")}
                          <Req />
                        </Label>
                        <Input id="employee-hire-date" type="date" {...field("hireDate")} />
                        <FieldError msg={errors.hireDate} />
                      </div>
                      <div>
                        <Label htmlFor="employee-birth-date">
                          {t("employee.birthday")}
                          <Req />
                        </Label>
                        <Input id="employee-birth-date" type="date" {...field("birthDate")} />
                        <FieldError msg={errors.birthDate} />
                      </div>
                    </DialogFormGrid>
                    <Button
                      onClick={save}
                      className="mt-6 w-full"
                      disabled={create.isPending || !employeeSchema.safeParse(form).success}
                    >
                      {t("employee.save")}
                    </Button>
                  </DialogBody>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {employees.isLoading &&
          Array.from({ length: 8 }).map((_, index) => (
            <Card key={`skeleton-${index}`} className="bg-card">
              <CardContent className="flex flex-col items-center p-6 text-center">
                <Skeleton className="h-24 w-24 rounded-full" />
                <Skeleton className="mt-4 h-6 w-3/4" />
                <Skeleton className="mt-2 h-4 w-1/2" />
                <Skeleton className="mt-5 h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        {items.map((employee) => {
          const canInvite = isAdmin && !employee.userId && !!employee.email;
          return (
            <Card key={employee.id} className="bg-card">
              <CardContent className="flex flex-col items-center p-6 text-center">
                <EmployeeAvatar employee={employee} />
                <div className="mt-4 w-full truncate text-lg font-semibold text-foreground">
                  {employee.firstName} {employee.lastName}
                </div>
                <div className="mt-1 w-full truncate text-sm text-muted-foreground">
                  {employee.jobTitle ?? "—"}
                </div>

                {isAdmin && <div className="mt-3">{accountBadge(employee)}</div>}

                <div className="mt-4 flex items-center gap-2">
                  <SocialBtn>
                    <Facebook className="h-4 w-4" />
                  </SocialBtn>
                  <SocialBtn>
                    <XIcon className="h-3.5 w-3.5" />
                  </SocialBtn>
                  <SocialBtn>
                    <Linkedin className="h-4 w-4" />
                  </SocialBtn>
                  <SocialBtn>
                    <Youtube className="h-4 w-4" />
                  </SocialBtn>
                  <SocialBtn>
                    <Globe className="h-4 w-4" />
                  </SocialBtn>
                </div>

                <div className="mt-5 grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto w-full min-w-0 whitespace-normal break-words py-2"
                    onClick={() =>
                      navigate({ to: "/app/employees/$id", params: { id: employee.id } })
                    }
                  >
                    {t("employee.view")}
                  </Button>
                  {canInvite && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-auto w-full min-w-0 whitespace-normal break-words py-2"
                      disabled={invitingId === employee.id}
                      onClick={() => invite(employee)}
                    >
                      <span className="shrink-0">
                        <Send className="mr-1.5 h-4 w-4" />
                      </span>
                      {pendingByEmployee.has(employee.id)
                        ? t("employees.resendInvite")
                        : t("employees.inviteJoin")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!employees.isLoading && items.length === 0 && (
          <div className="col-span-full rounded-lg border bg-card p-12 text-center text-muted-foreground">
            {employees.isError ? apiErrorMessage(employees.error) : t("employee.empty")}
          </div>
        )}
      </div>

      <div className="mt-4">
        <ListPager page={page} lastPage={lastPage} onChange={setPage} />
      </div>
    </div>
  );
}

/** Compteur d'employés par rapport au plafond de l'offre. */
function QuotaBanner({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();
  const { subscription } = useSubscription();
  const { data: used } = useQuery(employeeHeadcountQuery(organizationId));
  if (used === undefined) return null;
  const max = subscription.maxEmployes;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>{t("employees.quotaRegistered")}</span>
      <Badge variant={used >= max ? "destructive" : "secondary"}>
        {t("employees.quotaCount", { count: used, max })}
      </Badge>
      <span>{t("employees.quotaPlan", { plan: subscription.planName })}</span>
    </div>
  );
}
