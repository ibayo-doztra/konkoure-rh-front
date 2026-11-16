import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogActions, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmployeeCombobox } from "@/components/employees/EmployeeCombobox";
import { PageHeader } from "@/components/PageHeader";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/app/performance/feedback")({
  component: FeedbackPage,
});

type EmployeeLite = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  photo_url: string | null;
  position: string | null;
  manager_id: string | null;
  user_id: string | null;
};

const KINDS = ["kudos", "suggestion", "concern"] as const;

function FeedbackPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const { myEmployee, requireEmployee } = useMyEmployee();
  const { isAdmin, role } = useRole();
  const [items, setItems] = useState<any[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [okrs, setOkrs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ to: string; kind: (typeof KINDS)[number]; message: string; okr: string }>({
    to: "",
    kind: "kudos",
    message: "",
    okr: "none",
  });

  const isManager = isAdmin || role === "manager";

  const empById = useMemo(() => {
    const m: Record<string, EmployeeLite> = {};
    employees.forEach((e) => { m[e.id] = e; });
    return m;
  }, [employees]);

  const load = async () => {
    if (!org) return;
    const [{ data: fb }, { data: emps }, { data: okrList }] = await Promise.all([
      pendingQuery("GET /org/performance/feedback"),
      pendingQuery("GET /org/employees"),
      pendingQuery("GET /org/performance/okrs"),
    ]);
    setItems(fb ?? []);
    setEmployees((emps ?? []) as EmployeeLite[]);
    setOkrs(okrList ?? []);
  };
  useEffect(() => { void load(); }, [org]);

  const received = items.filter((f) => myEmployee && f.to_employee_id === myEmployee.id);
  const sent = items.filter((f) => myEmployee && f.from_employee_id === myEmployee.id);
  const teamIds = useMemo(
    () => employees.filter((e) => myEmployee && e.manager_id === myEmployee.id).map((e) => e.id),
    [employees, myEmployee],
  );
  const team = items.filter((f) => (isAdmin ? true : teamIds.includes(f.to_employee_id)));

  const options = employees.filter((e) => e.id !== myEmployee?.id);
  const recipientOkrs = okrs.filter((o) => o.employee_id === form.to);

  const submit = async () => {
    if (!org) return;
    if (!form.to) return toast.error(t("feedback.errors.recipientRequired"));
    if (form.message.trim().length < 3) return toast.error(t("feedback.errors.messageRequired"));
    const empId = await requireEmployee();
    if (empId === false) return;
    setBusy(true);
    const { error } = await pendingQuery("POST /org/performance/feedback");
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    const targetUser = empById[form.to]?.user_id;
    if (targetUser) {
      await pendingQuery("POST /me/notifications");
    }
    setBusy(false);
    setOpen(false);
    setForm({ to: "", kind: "kudos", message: "", okr: "none" });
    toast.success(t("feedback.sentSuccess"));
    void load();
  };

  const kindBadge = (kind: string) => {
    if (kind === "kudos") return <Badge variant="success">{t("feedback.kinds.kudos")}</Badge>;
    if (kind === "concern") return <Badge variant="destructive">{t("feedback.kinds.concern")}</Badge>;
    return <Badge className="bg-warning/10 text-warning hover:bg-warning/10">{t("feedback.kinds.suggestion")}</Badge>;
  };

  const name = (id: string | null) => {
    const e = id ? empById[id] : null;
    return e ? `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim() : t("feedback.anonymous");
  };

  const renderList = (list: any[]) => (
    <div className="grid gap-3">
      {list.map((f) => {
        const okr = f.okr_id ? okrs.find((o) => o.id === f.okr_id) : null;
        return (
          <Card key={f.id}><CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {kindBadge(f.kind)}
                <span className="text-sm font-medium">{name(f.from_employee_id)} → {name(f.to_employee_id)}</span>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleDateString()}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{f.message}</p>
            {okr && <p className="mt-2 text-xs text-muted-foreground">{t("feedback.linkedOkr")}: {okr.objective}</p>}
          </CardContent></Card>
        );
      })}
      {list.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t("feedback.empty")}</p>}
    </div>
  );

  return (
    <div>
      <PageHeader
        title={t("feedback.title")}
        description={t("feedback.description")}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t("feedback.give")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("feedback.give")}</DialogTitle></DialogHeader>
              <DialogBody>
                <div className="space-y-5">
                  <div>
                    <Label>{t("feedback.recipient")} <span className="text-destructive">*</span></Label>
                    <EmployeeCombobox
                      value={form.to}
                      onChange={(v) => setForm({ ...form, to: v, okr: "none" })}
                      options={options}
                      placeholder={t("feedback.choosePerson")}
                      searchPlaceholder={t("feedback.searchPerson")}
                      emptyMessage={t("feedback.noPersonFound")}
                    />
                  </div>
                  <div>
                    <Label>{t("feedback.kind")}</Label>
                    <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as (typeof KINDS)[number] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {KINDS.map((k) => <SelectItem key={k} value={k}>{t(`feedback.kinds.${k}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {recipientOkrs.length > 0 && (
                    <div>
                      <Label>{t("feedback.linkedOkr")}</Label>
                      <Select value={form.okr} onValueChange={(v) => setForm({ ...form, okr: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("feedback.noOkr")}</SelectItem>
                          {recipientOkrs.map((o) => <SelectItem key={o.id} value={o.id}>{o.objective}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label>{t("feedback.message")} <span className="text-destructive">*</span></Label>
                    <Textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={t("feedback.messagePlaceholder")} />
                  </div>
                  <DialogActions>
                    <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
                    <Button onClick={() => void submit()} disabled={busy}>{t("feedback.send")}</Button>
                  </DialogActions>
                </div>
              </DialogBody>
            </DialogContent>
          </Dialog>
        }
      />
      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received">{t("feedback.tabs.received")} ({received.length})</TabsTrigger>
          <TabsTrigger value="sent">{t("feedback.tabs.sent")} ({sent.length})</TabsTrigger>
          {isManager && <TabsTrigger value="team">{t("feedback.tabs.team")} ({team.length})</TabsTrigger>}
        </TabsList>
        <TabsContent value="received" className="mt-4">{renderList(received)}</TabsContent>
        <TabsContent value="sent" className="mt-4">{renderList(sent)}</TabsContent>
        {isManager && <TabsContent value="team" className="mt-4">{renderList(team)}</TabsContent>}
      </Tabs>
    </div>
  );
}
