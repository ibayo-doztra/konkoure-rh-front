import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFormGrid, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Facebook, Linkedin, Youtube, Globe, Download, Phone, FileSpreadsheet, Upload, Send } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { formatEmployeeLabel } from "@/lib/utils";
import { ActionMenu } from "@/components/ActionMenu";
import { EmployeeImportDialog } from "@/components/employees/EmployeeImportDialog";
import { downloadTemplate } from "@/lib/employee-import";
import { getEmployeeAccountStates, inviteEmployeeUser } from "@/lib/api/legacy-functions";
import { createEmployee } from "@/lib/api/legacy-functions";
import { useSubscription } from "@/hooks/useSubscription";



function buildEmployeeSchema(t: (k: string) => string) {
  return z.object({
    first_name: z.string().trim().min(1, t("employee.errFirstName")).max(80),
    last_name: z.string().trim().min(1, t("employee.errLastName")).max(80),
    email: z.string().trim().email(t("employee.errEmail")).max(255),
    phone: z.string().trim().min(6, t("employee.errPhone")).max(30),
    job_title: z.string().trim().min(1, t("employee.errJobTitle")).max(120),
    department_id: z.string().uuid(t("employee.errDepartment")),
    manager_id: z.string().min(1, t("employee.errManager")),
    status: z.enum(["active", "on_leave", "terminated"]),
    hire_date: z.string().min(1, t("employee.errHireDate")),
    gender: z.enum(["male", "female"], { message: t("employee.errGender") }),
    birth_date: z.string().min(1, t("employee.errBirthDate")),
  });
}

type FormErrors = Partial<Record<string, string>>;

function Req() { return <span className="text-destructive"> *</span>; }
function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-destructive">{msg}</p> : null;
}

export const Route = createFileRoute("/_authenticated/app/employees/")({
  component: EmployeesPage,
});

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  status: string;
  department_id: string | null;
  manager_id: string | null;
  photo_url: string | null;
  hire_date: string | null;
  user_id: string | null;
}
interface Dept { id: string; name: string; manager_id: string | null; }

function csvEscape(v: unknown): string {
  let s = v == null ? "" : String(v);
  // Neutralise spreadsheet formulas.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2H21l-6.52 7.45L22 22h-6.78l-4.79-6.27L4.8 22H2l7.04-8.04L2 2h6.91l4.33 5.79L18.244 2zm-1.19 18h1.7L7.06 4H5.27l11.78 16z" />
    </svg>
  );
}

function EmployeeAvatar({ employee }: { employee: Employee }) {
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">(
    employee.photo_url ? "loading" : "idle"
  );
  const initials = `${employee.first_name?.[0] ?? "?"}${employee.last_name?.[0] ?? ""}`;
  const showSkeleton = status === "loading";
  return (
    <div className="relative h-24 w-24">
      {showSkeleton && (
        <Skeleton className="absolute inset-0 rounded-full" />
      )}
      <Avatar className="h-24 w-24 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
        {employee.photo_url && (
          <AvatarImage
            src={employee.photo_url}
            className="object-cover"
            loading="lazy"
            decoding="async"
            onLoadingStatusChange={(s) => setStatus(s)}
          />
        )}
        <AvatarFallback className="text-xl">{initials}</AvatarFallback>
      </Avatar>
    </div>
  );
}


function EmployeesPage() {
  const { t } = useTranslation();
  const employeeSchema = useMemo(() => buildEmployeeSchema(t), [t]);
  const { org } = useOrg();
  const { isAdmin } = useRole();
  const { user } = useAuth();

  const navigate = useNavigate();
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", job_title: "", department_id: "", manager_id: "", status: "active", hire_date: "", gender: "", birth_date: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [nameQuery, setNameQuery] = useState("");
  const [idQuery, setIdQuery] = useState("");
  const [designation, setDesignation] = useState("all");
  const [importOpen, setImportOpen] = useState(false);
  const [accountStates, setAccountStates] = useState<Record<string, "none" | "invited" | "active">>({});
  const [canInvite, setCanInvite] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);

  const fetchStates = getEmployeeAccountStates;
  const sendInvite = inviteEmployeeUser;
  const doCreateEmployee = createEmployee;

  const loadAccountStates = async (orgId: string) => {
    try {
      const res = await fetchStates({ data: { organizationId: orgId } });
      setAccountStates(res.states);
      setCanInvite(true);
    } catch {
      setCanInvite(false);
      setAccountStates({});
    }
  };

  const load = async () => {
    if (!org) return;
    setLoading(true);
    try {
      const { data } = await pendingQuery("GET /org/employees");
      setItems((data ?? []) as Employee[]);
      const { data: d } = await pendingQuery("GET /org/departments");
      setDepts((d ?? []) as Dept[]);
      void loadAccountStates(org.id);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [org]);

  const invite = async (employeeId: string) => {
    setInviting(employeeId);
    try {
      const res = await sendInvite({ data: { employeeId } });
      toast.success(
        res.resent
          ? t("employees.invitedNew", { email: res.email })
          : t("employees.invitedSent", { email: res.email }),
      );
      if (org) void loadAccountStates(org.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("employees.inviteImpossible"));
    } finally {
      setInviting(null);
    }
  };


  const deptMap = useMemo(() => Object.fromEntries(depts.map((d) => [d.id, d.name])), [depts]);
  const designations = useMemo(() => {
    const s = new Set<string>();
    items.forEach((e) => { if (e.job_title) s.add(e.job_title); });
    return Array.from(s).sort();
  }, [items]);
  const managerIds = useMemo(() => new Set(depts.map((d) => d.manager_id).filter((v): v is string => !!v)), [depts]);
  const managerOptions = useMemo(() => items.filter((e) => managerIds.has(e.id)), [items, managerIds]);

  const filtered = useMemo(() => items.filter((e) => {
    if (nameQuery) {
      const q = nameQuery.toLowerCase();
      const hay = `${e.first_name} ${e.last_name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (idQuery && !e.id.toLowerCase().startsWith(idQuery.toLowerCase())) return false;
    if (designation !== "all" && e.job_title !== designation) return false;
    return true;
  }), [items, nameQuery, idQuery, designation]);

  const save = async () => {
    if (!org) return;
    const parsed = employeeSchema.safeParse(form);
    if (!parsed.success) {
      const errs: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as string;
        if (!errs[k]) errs[k] = issue.message;
      }
      setErrors(errs);
      toast.error(t("employee.requiredAll"));
      return;
    }
    setErrors({});
    const v = parsed.data;
    try {
      await doCreateEmployee({
        data: {
          organizationId: org.id,
          first_name: v.first_name,
          last_name: v.last_name,
          email: v.email,
          phone: v.phone,
          job_title: v.job_title,
          department_id: v.department_id,
          manager_id: v.manager_id === "__none__" ? null : v.manager_id,
          status: v.status,
          hire_date: v.hire_date,
          profile_details: { gender: v.gender, birthday: v.birth_date },
        },
      });
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : t("employees.createImpossible"));
    }
    toast.success(t("employee.added"));
    setOpen(false);
    setForm({ first_name: "", last_name: "", email: "", phone: "", job_title: "", department_id: "", manager_id: "", status: "active", hire_date: "", gender: "", birth_date: "" });
    void load();
  };

  const exportCsv = () => {
    const headers = [t("employee.firstName"), t("employee.lastName"), t("employee.email"), t("employee.phone"), t("employee.jobTitle"), t("employee.department"), t("employee.hireDate")];
    const rows = filtered.map((e) => [
      e.first_name, e.last_name, e.email, e.phone, e.job_title,
      e.department_id ? deptMap[e.department_id] ?? "" : "",
      e.hire_date,
    ].map(csvEscape).join(","));
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t("employees.csvFileName")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SocialBtn = ({ children }: { children: React.ReactNode }) => (
    <button
      type="button"
      onClick={(ev) => ev.stopPropagation()}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/70"
      aria-hidden
    >
      {children}
    </button>
  );

  return (
    <div className="-m-6 min-h-[calc(100vh-4rem)] bg-background p-6">
      <div className="mb-6 flex justify-end">
        <ActionMenu
          label={t("employees.actionsLabel")}
          items={[
            { label: t("employees.exportCsv"), icon: <Download className="h-4 w-4" />, onSelect: exportCsv },
            ...(isAdmin
              ? ([
                  { type: "separator" },
                  {
                    label: t("employees.downloadTemplate"),
                    icon: <FileSpreadsheet className="h-4 w-4" />,
                    onSelect: () => void downloadTemplate(depts.map((d) => ({ id: d.id, name: d.name })), org?.name),
                  },
                  {
                    label: t("employees.importEmployees"),
                    icon: <Upload className="h-4 w-4" />,
                    onSelect: () => setImportOpen(true),
                  },
                ] as const)
              : []),
          ]}
        />
      </div>

      {org && (
        <EmployeeImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          orgId={org.id}
          orgName={org.name}
          departments={depts.map((d) => ({ id: d.id, name: d.name }))}
          existingEmails={items.map((e) => e.email ?? "").filter(Boolean)}
          onImported={() => void load()}
        />
      )}


      {isAdmin && <QuotaBanner used={items.length} />}

      {/* Filters bar — 4 white cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card">
          <CardContent className="flex h-full items-start p-6">
            <Input
              placeholder={t("employee.searchByName")}
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              className="h-10"
            />
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="flex h-full items-start p-6">
            <Input
              placeholder={t("employee.searchById")}
              value={idQuery}
              onChange={(e) => setIdQuery(e.target.value)}
              className="h-10"
            />
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="flex h-full items-start p-6">
            <Select value={designation} onValueChange={setDesignation}>
              <SelectTrigger className="h-10"><SelectValue placeholder={t("employee.designationPlaceholder")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("employee.allDesignations")}</SelectItem>
                {designations.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="flex h-full flex-col gap-3 p-6">
            <Button className="w-1/2 self-start bg-success text-success-foreground hover:opacity-90">{t("employee.filters")}</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              {isAdmin && (
                <DialogTrigger asChild>
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">{t("employee.addEmployee")}</Button>
                </DialogTrigger>
              )}
              <DialogContent>
                <DialogHeader><DialogTitle>{t("employee.newEmployee")}</DialogTitle></DialogHeader>
                <DialogBody>
                  <DialogFormGrid>
                    <div><Label>{t("employee.firstName")}<Req /></Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /><FieldError msg={errors.first_name} /></div>
                    <div><Label>{t("employee.lastName")}<Req /></Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /><FieldError msg={errors.last_name} /></div>
                    <div><Label>{t("employee.email")}<Req /></Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><FieldError msg={errors.email} /></div>
                    <div><Label>{t("employee.phone")}<Req /></Label><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><FieldError msg={errors.phone} /></div>
                    <div><Label>{t("employee.jobTitle")}<Req /></Label><Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /><FieldError msg={errors.job_title} /></div>
                    <div>
                      <Label>{t("employee.department")}<Req /></Label>
                      <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                        <SelectTrigger><SelectValue placeholder={t("employee.choose")} /></SelectTrigger>
                        <SelectContent>{depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <FieldError msg={errors.department_id} />
                    </div>
                    <div>
                      <Label>{t("employee.managerN1")}<Req /></Label>
                      <Select value={form.manager_id} onValueChange={(v) => setForm({ ...form, manager_id: v })}>
                        <SelectTrigger><SelectValue placeholder={t("employee.chooseManager")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t("employee.noManager")}</SelectItem>
                          {managerOptions.map((m) => {
                            const department = m.department_id && deptMap[m.department_id] ? deptMap[m.department_id] : null;
                            return (
                              <SelectItem key={m.id} value={m.id}>
                                {formatEmployeeLabel(m, department)}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FieldError msg={errors.manager_id} />
                    </div>
                    <div>
                      <Label>{t("employee.statusLabel")}<Req /></Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">{t("employee.statusActive")}</SelectItem>
                          <SelectItem value="on_leave">{t("employee.statusOnLeave")}</SelectItem>
                          <SelectItem value="terminated">{t("employee.statusTerminated")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>{t("employee.hireDate")}<Req /></Label><Input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /><FieldError msg={errors.hire_date} /></div>
                    <div><Label>{t("employee.birthday")}<Req /></Label><Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /><FieldError msg={errors.birth_date} /></div>
                    <div>
                      <Label>{t("employee.gender")}<Req /></Label>
                      <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                        <SelectTrigger><SelectValue placeholder={t("employee.chooseGender")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">{t("employee.male")}</SelectItem>
                          <SelectItem value="female">{t("employee.female")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError msg={errors.gender} />
                    </div>
                  </DialogFormGrid>
                  <Button onClick={save} className="mt-6 w-full" disabled={!employeeSchema.safeParse(form).success}>{t("employee.save")}</Button>
                </DialogBody>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* Employees grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading && Array.from({ length: 8 }).map((_, i) => (
          <Card key={`sk-${i}`} className="bg-card">
            <CardContent className="flex flex-col items-center p-6 text-center">
              <Skeleton className="h-24 w-24 rounded-full" />
              <Skeleton className="mt-4 h-6 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/2" />
              <div className="mt-4 flex items-center gap-2">
                {Array.from({ length: 5 }).map((__, j) => (
                  <Skeleton key={j} className="h-8 w-8 rounded-full" />
                ))}
              </div>
              <Skeleton className="mt-5 h-8 w-20" />
            </CardContent>
          </Card>
        ))}
        {!loading && filtered.map((e) => (
          <Card key={e.id} className="bg-card">
            <CardContent className="flex flex-col items-center p-6 text-center">
              <EmployeeAvatar employee={e} />

              <div className="mt-4 w-full truncate text-lg font-semibold text-foreground">
                {e.first_name} {e.last_name}
              </div>
              <div className="mt-1 w-full truncate text-sm text-muted-foreground">{e.job_title ?? "—"}</div>

              {canInvite && (
                <div className="mt-3">
                  {accountStates[e.id] === "active" && (
                    <Badge className="bg-success text-success-foreground">{t("employees.accountActive")}</Badge>
                  )}
                  {accountStates[e.id] === "invited" && (
                    <Badge variant="secondary">{t("employees.invitationSent")}</Badge>
                  )}
                  {(accountStates[e.id] ?? "none") === "none" && (
                    <Badge variant="outline">{t("employees.noAccount")}</Badge>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                <SocialBtn><Facebook className="h-4 w-4" /></SocialBtn>
                <SocialBtn><XIcon className="h-3.5 w-3.5" /></SocialBtn>
                <SocialBtn><Linkedin className="h-4 w-4" /></SocialBtn>
                <SocialBtn><Youtube className="h-4 w-4" /></SocialBtn>
                <SocialBtn><Globe className="h-4 w-4" /></SocialBtn>
              </div>

              <div className="mt-5 grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto w-full min-w-0 whitespace-normal break-words py-2"
                  onClick={() => navigate({ to: "/app/employees/$id", params: { id: e.id } })}
                >
                  {t("employee.view")}
                </Button>
                {canInvite && e.user_id !== user?.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto w-full min-w-0 whitespace-normal break-words py-2"
                    disabled={inviting === e.id}
                    onClick={() => void invite(e.id)}
                  >
                    <span className="shrink-0">
                      <Send className="mr-1.5 h-4 w-4" />
                    </span>
                    {accountStates[e.id] && accountStates[e.id] !== "none"
                      ? t("employees.resendInvite")
                      : t("employees.inviteJoin")}
                  </Button>
                )}
              </div>

            </CardContent>
          </Card>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="col-span-full rounded-lg border bg-card p-12 text-center text-muted-foreground">
            {t("employee.empty")}
          </div>
        )}
      </div>


    </div>
  );
}


/** Compteur d'employés par rapport au plafond de l'offre. */
function QuotaBanner({ used }: { used: number }) {
  const { t } = useTranslation();
  const { subscription } = useSubscription();
  const max = subscription.maxEmployes;
  const full = used >= max;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>{t("employees.quotaRegistered")}</span>
      <Badge variant={full ? "destructive" : "secondary"}>
        {t("employees.quotaCount", { count: used, max })}
      </Badge>
      <span>{t("employees.quotaPlan", { plan: subscription.planName })}</span>
    </div>
  );
}
