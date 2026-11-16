import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatDate, formatDateLong } from "@/lib/format";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogActions, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Pencil, Plus, Trash2, Facebook, Twitter, Linkedin, Youtube, Globe, Mail, Camera, Eye, Upload, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { formatEmployeeLabel, maskBadgeUid } from "@/lib/utils";
import { NfcBadgeCard } from "@/components/employees/NfcBadgeCard";
import { LeaveBalanceCard } from "@/components/employees/LeaveBalanceCard";
import { getEmployeeBadgeInfo, getEmployeeSensitive, updateEmployeeProfileDetails } from "@/lib/api/legacy-functions";
import { inviteEmployeeUser } from "@/lib/api/legacy-functions";


export const Route = createFileRoute("/_authenticated/app/employees/$id")({
  component: EmployeeDetailPage,
});

interface EduItem { school: string; degree: string; period: string; }
interface ExpItem { company: string; role: string; period: string; }
interface ContactItem { name: string; relationship: string; phone: string; email: string; address: string; }
interface ProfileDetails {
  birthday?: string;
  gender?: string;
  address?: string;
  emergency?: { primary?: ContactItem; secondary?: ContactItem };
  education?: EduItem[];
  experience?: ExpItem[];
  
  passport?: { number?: string; nationality?: string; issue_date?: string; expiry_date?: string; scan_url?: string };
  social?: { linkedin?: string; twitter?: string; facebook?: string; instagram?: string; whatsapp?: string };
}
interface Employee {
  id: string; first_name: string; last_name: string; email: string | null; phone: string | null;
  job_title: string | null; status: string; department_id: string | null; manager_id: string | null;
  hire_date: string | null; photo_url: string | null; profile_details: ProfileDetails | null;
  user_id: string | null;
}

function SectionCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-border bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
        <button onClick={onEdit} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition hover:bg-primary/20">
          <Pencil className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-foreground">{label}</div>
      <div className="text-sm text-muted-foreground">{value || "—"}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-sm text-muted-foreground">{value || "—"}</span>
    </div>
  );
}


function EmployeeDetailPage() {
  const { id } = useParams({ from: "/_authenticated/app/employees/$id" });
  const { org } = useOrg();
  const getBadgeInfo = getEmployeeBadgeInfo;
  const fetchSensitive = getEmployeeSensitive;
  const saveProfileDetails = updateEmployeeProfileDetails;

  const { t } = useTranslation();
  const fmtDate = (d?: string | null) => formatDateLong(d);
  const fmtShort = (d?: string | null) => formatDate(d);
  const renderGender = (g?: string) => g === "male" ? t("employee.male") : g === "female" ? t("employee.female") : (g || "");

  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [emp, setEmp] = useState<Employee | null>(null);
  const [manager, setManager] = useState<{ first_name: string; last_name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [badgeInfo, setBadgeInfo] = useState<{ authorized: boolean; uid: string | null }>({ authorized: false, uid: null });
  const sendInvite = inviteEmployeeUser;
  const [inviting, setInviting] = useState(false);
  const invite = async (employeeId: string) => {
    setInviting(true);
    try {
      const res = await sendInvite({ data: { employeeId } });
      toast.success(res.resent ? t("employees.invitedNew", { email: res.email }) : t("employees.invitedSent", { email: res.email }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("employees.inviteImpossible"));
    } finally {
      setInviting(false);
    }
  };


  const load = async () => {
    if (!org) return;
    setLoading(true);
    const [{ data }, badge, sensitive] = await Promise.all([
      pendingQuery("GET /org/employees"),
      getBadgeInfo({ data: { employeeId: id } }),
      fetchSensitive({ data: { employeeId: id } }).catch(() => ({ profileDetails: null })),
    ]);
    const employee = data
      ? ({ ...(data as any), profile_details: (sensitive?.profileDetails as ProfileDetails | null) ?? null } as Employee)
      : null;

    setEmp(employee);
    setBadgeInfo({ authorized: badge.authorized, uid: badge.uid });
    if (employee?.manager_id) {
      const { data: m } = await pendingQuery("GET /org/employees");
      setManager((m as { first_name: string; last_name: string }) ?? null);
    } else {
      setManager(null);
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, [org, id]);

  const details = emp?.profile_details ?? {};
  // Sa propre fiche : on ne s'envoie pas de message et on ne s'invite pas soi-même.
  const isSelf = !!emp?.user_id && emp.user_id === user?.id;

  const updateEmployee = async (patch: Record<string, unknown>) => {
    if (!emp) return;
    const { profile_details: pdPatch, ...rest } = patch as Record<string, unknown> & { profile_details?: ProfileDetails };
    if (Object.keys(rest).length > 0) {
      const { error } = await pendingQuery("PATCH /org/employees");
      if (error) return toast.error(error.message);
    }
    if (pdPatch !== undefined) {
      try {
        await saveProfileDetails({ data: { employeeId: emp.id, details: pdPatch as any } });
      } catch (e: any) {
        return toast.error(e?.message ?? "Erreur");
      }
    }

    toast.success(t("employee.saved"));
    setOpenDialog(null);
    void load();
  };

  const updateDetails = async (patch: Partial<ProfileDetails>) => {
    if (!emp) return;
    const merged = { ...(emp.profile_details ?? {}), ...patch };
    await updateEmployee({ profile_details: merged });
  };

  if (loading) return <div className="p-8 text-muted-foreground">{t("employee.loading")}</div>;
  if (!emp) return <div className="p-8 text-muted-foreground">{t("employee.notFound")}</div>;

  return (
    <div className="-m-4 min-h-screen bg-background p-4 md:-m-6 md:p-6">

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Personal Information */}
        <SectionCard title={t("employee.personal")} onEdit={() => setOpenDialog("personal")}>
          <div className="flex gap-5">
            <PhotoBlock emp={emp} onUploaded={async (url) => { await updateEmployee({ photo_url: url }); }} />
            <div className="flex-1">
              <h3 className="text-2xl font-semibold text-card-foreground">{emp.first_name} {emp.last_name}</h3>
              <p className="font-semibold text-foreground">{emp.job_title || "—"}</p>
              <p className="text-sm text-muted-foreground">{renderGender(details.gender)}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t("employee.dateOfJoin")} : {fmtShort(emp.hire_date)}</p>
              <p className="text-sm text-muted-foreground">{t("employee.manager")} : {manager ? `${manager.first_name} ${manager.last_name}` : "—"}</p>

              {!isSelf && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button className="bg-primary hover:bg-primary/90">
                    <Mail className="mr-2 h-4 w-4" /> {t("employee.sendMessage")}
                  </Button>
                  {isAdmin && (
                    <Button variant="outline" disabled={inviting} onClick={() => void invite(emp.id)}>
                      {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {t("employees.inviteJoin")}
                    </Button>
                  )}
                </div>
              )}

            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label={`${t("employee.phone")} :`} value={emp.phone} />
            <Field label={`${t("employee.email")} :`} value={emp.email} />
            <Field label={`${t("employee.birthday")} :`} value={fmtDate(details.birthday)} />
            <Field label={`${t("employee.gender")} :`} value={renderGender(details.gender)} />
            <div className="sm:col-span-2"><Field label={`${t("employee.address")} :`} value={details.address} /></div>
            {badgeInfo.authorized && (
              <div className="sm:col-span-2"><Field label={`${t("employee.badgeUid")} :`} value={maskBadgeUid(badgeInfo.uid)} /></div>
            )}
          </div>
        </SectionCard>

        {/* Emergency Contact */}
        <SectionCard title={t("employee.emergency")} onEdit={() => setOpenDialog("emergency")}>
          <div className="grid gap-6 sm:grid-cols-2">
            {(["primary", "secondary"] as const).map((k) => {
              const c = details.emergency?.[k];
              return (
                <div key={k} className="space-y-3">
                  <h4 className="text-base font-semibold text-card-foreground">{k === "primary" ? t("employee.primaryContact") : t("employee.secondaryContact")}</h4>
                  <Field label={`${t("employee.name")} :`} value={c?.name} />
                  <Field label={`${t("employee.relationship")} :`} value={c?.relationship} />
                  <Field label={`${t("employee.phone")} :`} value={c?.phone} />
                  <Field label={`${t("employee.email")} :`} value={c?.email} />
                  <Field label={`${t("employee.address")} :`} value={c?.address} />
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Education */}
        <SectionCard title={t("employee.education")} onEdit={() => setOpenDialog("education")}>
          <ul className="space-y-4">
            {(details.education ?? []).map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                <div>
                  <div className="font-semibold text-card-foreground">{e.school}</div>
                  <div className="text-sm text-muted-foreground">{e.degree}</div>
                  <div className="text-sm text-muted-foreground">{e.period}</div>
                </div>
              </li>
            ))}
            {(details.education ?? []).length === 0 && <li className="text-sm text-muted-foreground">{t("employee.noEducation")}</li>}

          </ul>
        </SectionCard>

        {/* Experience */}
        <SectionCard title={t("employee.experience")} onEdit={() => setOpenDialog("experience")}>
          <ul className="space-y-4">
            {(details.experience ?? []).map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                <div>
                  <div className="font-semibold text-card-foreground">{e.company}</div>
                  <div className="text-sm text-muted-foreground">{e.role}</div>
                  <div className="text-sm text-muted-foreground">{e.period}</div>
                </div>
              </li>
            ))}
            {(details.experience ?? []).length === 0 && <li className="text-sm text-muted-foreground">{t("employee.noExperience")}</li>}

          </ul>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">


        <SectionCard title={t("employee.passport")} onEdit={() => setOpenDialog("passport")}>
          <Row label={`${t("employee.passportNumber")} :`} value={details.passport?.number} />
          <Row label={`${t("employee.nationality")} :`} value={details.passport?.nationality} />
          <Row label={`${t("employee.issueDate")} :`} value={fmtShort(details.passport?.issue_date)} />
          <Row label={`${t("employee.expiryDate")} :`} value={fmtShort(details.passport?.expiry_date)} />
          <Row label={`${t("employee.scanCopy")} :`} value={details.passport?.scan_url ? <PassportScanLink pathOrUrl={details.passport.scan_url} label={t("employee.view")} /> : "—"} />
        </SectionCard>

        <SectionCard title={t("employee.social")} onEdit={() => setOpenDialog("social")}>
          <Row label={`${t("employee.linkedin")} :`} value={details.social?.linkedin} />
          <Row label={`${t("employee.twitter")} :`} value={details.social?.twitter} />
          <Row label={`${t("employee.facebook")} :`} value={details.social?.facebook} />
          <Row label={`${t("employee.instagram")} :`} value={details.social?.instagram} />
          <Row label={`${t("employee.whatsapp")} :`} value={details.social?.whatsapp} />
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <LeaveBalanceCard employeeId={emp.id} />
        <NfcBadgeCard employeeId={emp.id} onUpdated={() => void load()} />
      </div>

      {/* Edit dialogs */}
      <PersonalDialog open={openDialog === "personal"} onClose={() => setOpenDialog(null)} emp={emp} details={details} onSave={async (p, d) => { await updateEmployee({ ...p, profile_details: { ...details, ...d } }); }} />
      <EmergencyDialog open={openDialog === "emergency"} onClose={() => setOpenDialog(null)} value={details.emergency ?? {}} onSave={(v) => updateDetails({ emergency: v })} />
      <ListDialog open={openDialog === "education"} onClose={() => setOpenDialog(null)} title={t("employee.education")} items={(details.education ?? []) as unknown as Record<string, string>[]} fields={["school", "degree", "period"]} labels={[t("employee.school"), t("employee.degree"), t("employee.period")]} onSave={(items) => updateDetails({ education: items as unknown as EduItem[] })} />
      <ListDialog open={openDialog === "experience"} onClose={() => setOpenDialog(null)} title={t("employee.experience")} items={(details.experience ?? []) as unknown as Record<string, string>[]} fields={["company", "role", "period"]} labels={[t("employee.company"), t("employee.role"), t("employee.period")]} onSave={(items) => updateDetails({ experience: items as unknown as ExpItem[] })} />
      
      <PassportDialog open={openDialog === "passport"} onClose={() => setOpenDialog(null)} employeeId={emp.id} value={details.passport ?? {}} onSave={(v) => updateDetails({ passport: v })} />
      <SocialDialog open={openDialog === "social"} onClose={() => setOpenDialog(null)} value={details.social ?? {}} onSave={(v) => updateDetails({ social: v })} />
    </div>
  );
}

/* -------------------- Dialogs -------------------- */

function DialogShell({ open, onClose, title, children, onSave }: { open: boolean; onClose: () => void; title: string; children: ReactNode; onSave: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="space-y-4">{children}</div>
          <DialogActions>
            <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
            <Button onClick={onSave} className="bg-primary hover:bg-primary/90">{t("common.save")}</Button>
          </DialogActions>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function PersonalDialog({ open, onClose, emp, details, onSave }: { open: boolean; onClose: () => void; emp: Employee; details: ProfileDetails; onSave: (p: Partial<Employee>, d: Partial<ProfileDetails>) => Promise<void> }) {
  const { org } = useOrg();
  const { t } = useTranslation();
  const [first, setFirst] = useState(emp.first_name);
  const [last, setLast] = useState(emp.last_name);
  const [email, setEmail] = useState(emp.email ?? "");
  const [phone, setPhone] = useState(emp.phone ?? "");
  const [job, setJob] = useState(emp.job_title ?? "");
  const [hire, setHire] = useState(emp.hire_date ?? "");
  const [photo, setPhoto] = useState(emp.photo_url ?? "");
  const [birthday, setBirthday] = useState(details.birthday ?? "");
  const [gender, setGender] = useState(details.gender ?? "");
  const [address, setAddress] = useState(details.address ?? "");
  const [managerId, setManagerId] = useState<string>(emp.manager_id ?? "");
  const [managers, setManagers] = useState<{ id: string; first_name: string; last_name: string; job_title: string | null; department_id: string | null }[]>([]);
  const [deptMap, setDeptMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setFirst(emp.first_name); setLast(emp.last_name); setEmail(emp.email ?? ""); setPhone(emp.phone ?? ""); setJob(emp.job_title ?? ""); setHire(emp.hire_date ?? ""); setPhoto(emp.photo_url ?? ""); setBirthday(details.birthday ?? ""); setGender(details.gender ?? ""); setAddress(details.address ?? ""); setManagerId(emp.manager_id ?? "");
    if (!org) return;
    void (async () => {
      const { data, error } = await pendingQuery("GET /org/employees");
      if (error) { toast.error(error.message); return; }
      setManagers((data as { id: string; first_name: string; last_name: string; job_title: string | null; department_id: string | null }[]) ?? []);
      const { data: d } = await pendingQuery("GET /org/departments");
      setDeptMap(Object.fromEntries(((d as { id: string; name: string }[]) ?? []).map((x) => [x.id, x.name])));
    })();
  }, [open, emp, details, org]);
  return (
    <DialogShell open={open} onClose={onClose} title={t("employee.personal")} onSave={() => onSave({ first_name: first, last_name: last, email: email || null, phone: phone || null, job_title: job || null, hire_date: hire || null, photo_url: photo || null, manager_id: managerId && managerId !== "__none__" ? managerId : null }, { birthday, gender, address })}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>{t("employee.firstName")}</Label><Input value={first} onChange={(e) => setFirst(e.target.value)} /></div>
        <div><Label>{t("employee.lastName")}</Label><Input value={last} onChange={(e) => setLast(e.target.value)} /></div>
        <div><Label>{t("employee.email")}</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label>{t("employee.phone")}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div><Label>{t("employee.jobTitle")}</Label><Input value={job} onChange={(e) => setJob(e.target.value)} /></div>
        <div><Label>{t("employee.hireDate")}</Label><Input type="date" value={hire} onChange={(e) => setHire(e.target.value)} /></div>
        <div><Label>{t("employee.birthday")}</Label><Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} /></div>
        <div>
          <Label>{t("employee.gender")}</Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger><SelectValue placeholder={t("employee.chooseGender")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">{t("employee.male")}</SelectItem>
              <SelectItem value="female">{t("employee.female")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>{t("employee.manager")}</Label>
          <Select value={managerId} onValueChange={setManagerId}>
            <SelectTrigger><SelectValue placeholder={t("employee.chooseManager")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t("employee.noManager")}</SelectItem>
              {managers.map((m) => {
                const department = m.department_id && deptMap[m.department_id] ? deptMap[m.department_id] : null;
                return (
                  <SelectItem key={m.id} value={m.id}>
                    {formatEmployeeLabel(m, department)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2"><Label>{t("employee.address")}</Label><Textarea value={address} onChange={(e) => setAddress(e.target.value)} /></div>
      </div>
    </DialogShell>
  );
}

function ContactBlock({ title, value, onChange }: { title: string; value: ContactItem; onChange: (v: ContactItem) => void }) {
  const { t } = useTranslation();
  const labels: Record<keyof ContactItem, string> = {
    name: t("employee.name"),
    relationship: t("employee.relationship"),
    phone: t("employee.phone"),
    email: t("employee.email"),
    address: t("employee.address"),
  };
  return (
    <div className="space-y-2">
      <h4 className="font-medium">{title}</h4>
      {(["name", "relationship", "phone", "email", "address"] as const).map((k) => (
        <div key={k}><Label>{labels[k]}</Label><Input value={value[k] ?? ""} onChange={(e) => onChange({ ...value, [k]: e.target.value })} /></div>
      ))}
    </div>
  );
}

function EmergencyDialog({ open, onClose, value, onSave }: { open: boolean; onClose: () => void; value: { primary?: ContactItem; secondary?: ContactItem }; onSave: (v: { primary?: ContactItem; secondary?: ContactItem }) => Promise<void> }) {
  const { t } = useTranslation();
  const empty: ContactItem = { name: "", relationship: "", phone: "", email: "", address: "" };
  const [primary, setPrimary] = useState<ContactItem>(value.primary ?? empty);
  const [secondary, setSecondary] = useState<ContactItem>(value.secondary ?? empty);
  useEffect(() => { if (open) { setPrimary(value.primary ?? empty); setSecondary(value.secondary ?? empty); } }, [open]);
  return (
    <DialogShell open={open} onClose={onClose} title={t("employee.emergency")} onSave={() => onSave({ primary, secondary })}>
      <div className="grid gap-6 sm:grid-cols-2">
        <ContactBlock title={t("employee.primaryContact")} value={primary} onChange={setPrimary} />
        <ContactBlock title={t("employee.secondaryContact")} value={secondary} onChange={setSecondary} />
      </div>
    </DialogShell>
  );
}

function ListDialog<T extends Record<string, string>>({ open, onClose, title, items, fields, labels, onSave }: { open: boolean; onClose: () => void; title: string; items: T[]; fields: (keyof T)[]; labels: string[]; onSave: (items: T[]) => Promise<void> }) {
  const { t } = useTranslation();
  const empty = Object.fromEntries(fields.map((f) => [f, ""])) as T;
  const [list, setList] = useState<T[]>(items);
  useEffect(() => { if (open) setList(items.length ? items : [empty]); }, [open]);
  return (
    <DialogShell open={open} onClose={onClose} title={title} onSave={() => onSave(list.filter((it) => Object.values(it).some((v) => v)))}>
      <div className="space-y-4">
        {list.map((it, i) => (
          <div key={i} className="grid gap-2 rounded border p-3 sm:grid-cols-3">
            {fields.map((f, j) => (
              <div key={String(f)}><Label>{labels[j]}</Label><Input value={it[f] ?? ""} onChange={(e) => { const next = [...list]; next[i] = { ...next[i], [f]: e.target.value } as T; setList(next); }} /></div>
            ))}
            <div className="sm:col-span-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setList(list.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setList([...list, empty])}><Plus className="mr-1 h-4 w-4" /> {t("employee.add")}</Button>
      </div>
    </DialogShell>
  );
}

function FieldsDialog({ open, onClose, title, value, fields, onSave }: { open: boolean; onClose: () => void; title: string; value: Record<string, string | undefined>; fields: { key: string; label: string; type?: string }[]; onSave: (v: Record<string, string>) => Promise<void> }) {
  const [v, setV] = useState<Record<string, string>>({});
  useEffect(() => { if (open) setV(Object.fromEntries(fields.map((f) => [f.key, value[f.key] ?? ""]))); }, [open]);
  return (
    <DialogShell open={open} onClose={onClose} title={title} onSave={() => onSave(v)}>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key}><Label>{f.label}</Label><Input type={f.type ?? "text"} value={v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} /></div>
        ))}
      </div>
    </DialogShell>
  );
}

function PassportDialog({ open, onClose, employeeId, value, onSave }: { open: boolean; onClose: () => void; employeeId: string; value: ProfileDetails["passport"]; onSave: (v: ProfileDetails["passport"]) => Promise<void> }) {
  const { t } = useTranslation();
  const [v, setV] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const fields = [
    { key: "number", label: t("employee.passportNumber"), type: "text" },
    { key: "nationality", label: t("employee.nationality"), type: "text" },
    { key: "issue_date", label: t("employee.issueDate"), type: "date" },
    { key: "expiry_date", label: t("employee.expiryDate"), type: "date" },
  ];
  useEffect(() => {
    if (open) {
      const src = (value ?? {}) as Record<string, string>;
      setV({
        number: src.number ?? "",
        nationality: src.nationality ?? "",
        issue_date: src.issue_date ?? "",
        expiry_date: src.expiry_date ?? "",
        scan_url: src.scan_url ?? "",
      });
    }
  }, [open]);

  const ACCEPTED = ["application/pdf", "image/png", "image/jpeg"];
  const MAX_BYTES = 10 * 1024 * 1024;

  const handleFile = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error(t("employees.passportInvalidFormat"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("employees.fileTooLarge"));
      return;
    }
    setUploading(true);
    try {
      const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
      const path = `employees/${employeeId}/passport-${Date.now()}.${ext}`;
      const { error } = await pendingQuery("POST signed-url (storage employee-docs.upload)");
      if (error) throw error;
      setV((prev) => ({ ...prev, scan_url: path }));
      toast.success(t("employees.scanImported"));
    } catch (e: any) {
      toast.error(e?.message ?? t("employees.importFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <DialogShell open={open} onClose={onClose} title={t("employee.passport")} onSave={() => onSave(v)}>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key}>
            <Label>{f.label}</Label>
            <Input type={f.type} value={v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
          </div>
        ))}
        <div className="sm:col-span-2">
          <Label>{t("employee.scanCopy")}</Label>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
          />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("common.sending")}</>) : (<><Upload className="mr-2 h-4 w-4" />{v.scan_url ? t("employees.replaceScan") : t("employees.uploadScan")}</>)}
            </Button>
            {v.scan_url && (
              <>
                <PassportScanLink pathOrUrl={v.scan_url} label={t("employee.view")} />
                <Button type="button" variant="ghost" size="sm" onClick={() => setV((prev) => ({ ...prev, scan_url: "" }))}>
                  {t("employees.removeScan")}
                </Button>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("employees.scanHint")}</p>
        </div>
      </div>
    </DialogShell>
  );
}

function PassportScanLink({ pathOrUrl, label }: { pathOrUrl: string; label: string }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const resolveStorageTarget = (value: string): { bucket: "employee-docs" | "avatars"; path: string } | null => {
    if (!value) return null;
    if (!/^https?:\/\//i.test(value)) {
      const bucket = value.startsWith("employees/") ? "employee-docs" : "avatars";
      return { bucket, path: value };
    }

    try {
      const url = new URL(value);
      const marker = "/storage/v1/object/";
      const markerIndex = url.pathname.indexOf(marker);
      if (markerIndex === -1) return null;

      const parts = url.pathname.slice(markerIndex + marker.length).split("/");
      const accessMode = parts.shift();
      const bucket = parts.shift();
      if ((accessMode !== "public" && accessMode !== "sign") || (bucket !== "employee-docs" && bucket !== "avatars")) return null;

      return { bucket, path: decodeURIComponent(parts.join("/")) };
    } catch {
      return null;
    }
  };

  const open = async () => {
    const storageTarget = resolveStorageTarget(pathOrUrl);
    if (!storageTarget && /^https?:\/\//i.test(pathOrUrl)) {
      window.open(pathOrUrl, "_blank", "noreferrer");
      return;
    }
    setLoading(true);
    try {
      const target = storageTarget ?? { bucket: "employee-docs" as const, path: pathOrUrl };
      const { data, error } = await pendingQuery("GET signed-url (storage ?.createSignedUrl)");
      if (error || !data?.signedUrl) throw error ?? new Error(t("employees.urlNotFound"));
      window.open(data.signedUrl, "_blank", "noreferrer");
    } catch (e: any) {
      toast.error(e?.message ?? t("employees.openScanFailed"));
    } finally {
      setLoading(false);
    }
  };
  return (
    <button type="button" onClick={open} disabled={loading} className="text-sm text-primary underline disabled:opacity-60">
      {loading ? "…" : label}
    </button>
  );
}
function SocialDialog({ open, onClose, value, onSave }: { open: boolean; onClose: () => void; value: ProfileDetails["social"]; onSave: (v: ProfileDetails["social"]) => Promise<void> }) {
  const { t } = useTranslation();
  return <FieldsDialog open={open} onClose={onClose} title={t("employee.social")} value={(value ?? {}) as Record<string, string>} fields={[
    { key: "linkedin", label: t("employee.linkedin") }, { key: "twitter", label: t("employee.twitter") }, { key: "facebook", label: t("employee.facebook") }, { key: "instagram", label: t("employee.instagram") }, { key: "whatsapp", label: t("employee.whatsapp") },
  ]} onSave={(v) => onSave(v)} />;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
const _unused = { DialogTrigger, Facebook, Twitter, Linkedin, Youtube, Globe, Upload };

function PhotoBlock({ emp, onUploaded }: { emp: Employee; onUploaded: (url: string) => void | Promise<void> }) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `employees/${emp.id}/${Date.now()}.${ext}`;
      const { error } = await pendingQuery("POST signed-url (storage avatars.upload)");
      if (error) throw error;
      const { data } = await pendingQuery("GET signed-url (storage avatars.getPublicUrl)");
      const bustedUrl = `${data.publicUrl}?t=${Date.now()}`;
      await onUploaded(bustedUrl);
      toast.success(t("employee.photoUpdated"));
    } catch (e: any) {
      toast.error(e?.message ?? t("employee.uploadFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const openViewer = () => {
    if (!emp.photo_url) {
      toast.info(t("employee.noPhoto"));
      return;
    }
    setViewerOpen(true);
  };

  return (
    <div className="relative h-24 w-24 shrink-0">
      <Avatar className="h-24 w-24 bg-warning ring-2 ring-border ring-offset-2 ring-offset-background">
        {emp.photo_url && <AvatarImage src={emp.photo_url} className="object-cover" />}
        <AvatarFallback className="bg-warning text-2xl font-semibold text-warning-foreground">
          {(emp.first_name?.[0] ?? "?")}{(emp.last_name?.[0] ?? "")}
        </AvatarFallback>
      </Avatar>
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/40">
          <Loader2 className="h-6 w-6 animate-spin text-background" />
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={uploading}
            className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={t("employee.editPhotoAria")}
          >
            <Camera className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="cursor-pointer" onSelect={() => fileRef.current?.click()}>
            <Camera className="mr-2 h-4 w-4" /> {t("employee.changePhoto")}
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onSelect={openViewer}>
            <Eye className="mr-2 h-4 w-4" /> {t("employee.viewFullSize")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-[95vw] border-none bg-transparent p-0 shadow-none [&>button]:text-white [&>button]:opacity-100">
          <DialogHeader className="sr-only">
            <DialogTitle>{`${emp.first_name} ${emp.last_name}`}</DialogTitle>
          </DialogHeader>
          {emp.photo_url && (
            <img src={emp.photo_url} alt={`${emp.first_name} ${emp.last_name}`} className="mx-auto max-h-[90vh] max-w-[95vw] rounded-lg object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
