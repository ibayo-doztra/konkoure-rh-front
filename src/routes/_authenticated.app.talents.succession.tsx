import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api/client";
import { allEmployeesQuery } from "@/lib/api/hr";
import {
  createSuccessionPlan,
  deleteSuccessionPlan,
  READINESS,
  READINESS_CLASS,
  successionQuery,
  talentsKey,
  updateSuccessionPlan,
  type Readiness,
  type SuccessionInput,
  type SuccessionPlan,
} from "@/lib/api/talents";
import { useOrg } from "@/hooks/useOrg";
import { PageHeader } from "@/components/PageHeader";
import { ListPager, useClampedPage } from "@/components/ListPager";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ActionMenu } from "@/components/ActionMenu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogFormGrid,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/talents/succession")({
  component: SuccessionPage,
});

const ALL = "all";
const NONE = "none";

/** Succession plans: one key position, its holder and a successor (owner, hr_admin). */
function SuccessionPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [readiness, setReadiness] = useState<string>(ALL);
  const plans = useQuery({
    ...successionQuery(organizationId, {
      page,
      readiness: readiness === ALL ? undefined : (readiness as Readiness),
    }),
    enabled: !!org,
  });
  const lastPage = plans.data?.meta.lastPage ?? 1;
  useClampedPage(lastPage, page, setPage);
  // `undefined`: closed; `null`: new plan.
  const [editing, setEditing] = useState<SuccessionPlan | null | undefined>(undefined);
  const [removing, setRemoving] = useState<SuccessionPlan | null>(null);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: [...talentsKey(organizationId), "succession"] });
  const remove = useMutation({
    mutationFn: (plan: SuccessionPlan) => deleteSuccessionPlan(plan.id),
    onSuccess: () => {
      toast.success(t("talents.succession.deleted"));
      setRemoving(null);
      return refresh();
    },
    onError: (e) => {
      setRemoving(null);
      toast.error(apiErrorMessage(e));
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("talents.succession.title")}
        description={t("talents.succession.description")}
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("talents.succession.new")}
          </Button>
        }
      />

      <Select
        value={readiness}
        onValueChange={(v) => {
          setReadiness(v);
          setPage(1);
        }}
      >
        <SelectTrigger
          className="w-full sm:w-[240px]"
          aria-label={t("talents.succession.filterReadiness")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("talents.succession.allReadiness")}</SelectItem>
          {READINESS.map((r) => (
            <SelectItem key={r} value={r}>
              {t(`talents.succession.readinessLabels.${r}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {plans.isPending ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : plans.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(plans.error)}</p>
      ) : plans.data.data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("talents.succession.empty")}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {plans.data.data.map((p) => (
            <Card key={p.id} data-testid="succession-card">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <h2 className="break-words font-semibold">{p.positionTitle}</h2>
                    {p.readiness ? (
                      <Badge className={`border-transparent ${READINESS_CLASS[p.readiness]}`}>
                        {t(`talents.succession.readinessLabels.${p.readiness}`)}
                      </Badge>
                    ) : (
                      <Badge variant="outline">{t("talents.succession.readinessUnknown")}</Badge>
                    )}
                  </div>
                  <ActionMenu
                    label={t("common.actions")}
                    items={[
                      {
                        label: t("common.edit"),
                        icon: <Pencil className="h-4 w-4" />,
                        onSelect: () => setEditing(p),
                      },
                      {
                        label: t("common.delete"),
                        icon: <Trash2 className="h-4 w-4" />,
                        variant: "destructive",
                        onSelect: () => setRemoving(p),
                      },
                    ]}
                  />
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">{t("talents.succession.holder")}</dt>
                  <dd className="min-w-0 truncate">{p.currentEmployee?.name ?? "—"}</dd>
                  <dt className="text-muted-foreground">{t("talents.succession.successor")}</dt>
                  <dd className="min-w-0 truncate">
                    {p.successorEmployee?.name ?? t("talents.succession.noSuccessor")}
                  </dd>
                </dl>
                {p.notes && (
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{p.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <ListPager page={page} lastPage={lastPage} onChange={setPage} />

      {editing !== undefined && (
        <SuccessionDialog plan={editing} onClose={() => setEditing(undefined)} onSaved={refresh} />
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(v) => !v && setRemoving(null)}
        title={t("talents.succession.deleteTitle", { position: removing?.positionTitle ?? "" })}
        description={t("talents.succession.deleteDesc")}
        actionLabel={t("common.delete")}
        actionVariant="destructive"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </div>
  );
}

function SuccessionDialog({
  plan,
  onClose,
  onSaved,
}: {
  plan: SuccessionPlan | null;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const { org } = useOrg();
  const employees = useQuery({ ...allEmployeesQuery(org?.id ?? ""), enabled: !!org });
  const [form, setForm] = useState({
    positionTitle: plan?.positionTitle ?? "",
    currentEmployeeId: plan?.currentEmployee?.id ?? NONE,
    successorEmployeeId: plan?.successorEmployee?.id ?? NONE,
    readiness: plan?.readiness ?? NONE,
    notes: plan?.notes ?? "",
  });
  const options = (employees.data ?? [])
    .filter((e) => e.status !== "terminated")
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

  const save = useMutation({
    mutationFn: () => {
      const input: SuccessionInput = {
        positionTitle: form.positionTitle.trim(),
        currentEmployeeId: form.currentEmployeeId === NONE ? null : form.currentEmployeeId,
        successorEmployeeId: form.successorEmployeeId === NONE ? null : form.successorEmployeeId,
        readiness: form.readiness === NONE ? null : (form.readiness as Readiness),
        notes: form.notes.trim() || null,
      };
      return plan ? updateSuccessionPlan(plan.id, input) : createSuccessionPlan(input);
    },
    onSuccess: async () => {
      toast.success(plan ? t("talents.succession.updated") : t("talents.succession.created"));
      onClose();
      await onSaved();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const employeeSelect = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    exclude: string,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t("talents.succession.nobody")}</SelectItem>
          {options
            .filter((e) => e.id !== exclude)
            .map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.firstName} {e.lastName}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {plan ? t("talents.succession.editTitle") : t("talents.succession.new")}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (form.positionTitle.trim()) save.mutate();
            }}
          >
            <DialogFormGrid>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="succession-position">{t("talents.succession.position")}</Label>
                <Input
                  id="succession-position"
                  value={form.positionTitle}
                  maxLength={200}
                  placeholder={t("talents.succession.positionPlaceholder")}
                  onChange={(e) => setForm({ ...form, positionTitle: e.target.value })}
                />
              </div>
              {employeeSelect(
                "succession-holder",
                t("talents.succession.holder"),
                form.currentEmployeeId,
                (v) => setForm({ ...form, currentEmployeeId: v }),
                form.successorEmployeeId,
              )}
              {employeeSelect(
                "succession-successor",
                t("talents.succession.successor"),
                form.successorEmployeeId,
                (v) => setForm({ ...form, successorEmployeeId: v }),
                form.currentEmployeeId,
              )}
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="succession-readiness">{t("talents.succession.readiness")}</Label>
                <Select
                  value={form.readiness}
                  onValueChange={(v) => setForm({ ...form, readiness: v as Readiness })}
                >
                  <SelectTrigger id="succession-readiness">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("talents.succession.readinessUnknown")}</SelectItem>
                    {READINESS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`talents.succession.readinessLabels.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="succession-notes">{t("talents.succession.notes")}</Label>
                <Textarea
                  id="succession-notes"
                  rows={3}
                  maxLength={5000}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </DialogFormGrid>
            <DialogActions>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={!form.positionTitle.trim() || save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("common.save")}
              </Button>
            </DialogActions>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
