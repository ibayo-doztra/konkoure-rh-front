import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api/client";
import { departmentsQuery } from "@/lib/api/hr";
import {
  createSkill,
  deleteSkill,
  SKILL_LEVELS,
  skillsMatrixQuery,
  skillsQuery,
  talentsKey,
  updateSkill,
  updateSkillsMatrix,
  type Skill,
  type SkillLevel,
  type SkillsMatrixEntry,
} from "@/lib/api/talents";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { PageHeader } from "@/components/PageHeader";
import { ListPager, useClampedPage } from "@/components/ListPager";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ActionMenu } from "@/components/ActionMenu";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/talents/skills")({
  component: SkillsPage,
});

const ALL = "all";

/** Cell shade of a level, from 1 (light) to 5 (solid). */
const LEVEL_CLASS: Record<number, string> = {
  1: "bg-primary/10 text-foreground",
  2: "bg-primary/25 text-foreground",
  3: "bg-primary/45 text-foreground",
  4: "bg-primary/70 text-primary-foreground",
  5: "bg-primary text-primary-foreground",
};

/**
 * Skills matrix (owner and hr_admin edit it, a manager reads their team) and,
 * for owner and hr_admin, the organization's skills catalogue.
 */
function SkillsPage() {
  const { t } = useTranslation();
  const { isAdmin } = useRole();
  return (
    <div className="space-y-6">
      <PageHeader title={t("talents.skills.title")} description={t("talents.skills.description")} />
      {isAdmin ? (
        <Tabs defaultValue="matrix">
          <TabsList>
            <TabsTrigger value="matrix">{t("talents.skills.tabs.matrix")}</TabsTrigger>
            <TabsTrigger value="catalog">{t("talents.skills.tabs.catalog")}</TabsTrigger>
          </TabsList>
          <TabsContent value="matrix" className="pt-4">
            <SkillsMatrix editable />
          </TabsContent>
          <TabsContent value="catalog" className="pt-4">
            <SkillsCatalog />
          </TabsContent>
        </Tabs>
      ) : (
        <SkillsMatrix editable={false} />
      )}
    </div>
  );
}

const cellKey = (employeeId: string, skillId: string) => `${employeeId}:${skillId}`;

function SkillsMatrix({ editable }: { editable: boolean }) {
  const { t } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [departmentId, setDepartmentId] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  /** Unsaved cells, kept across pages and filters until saved or cancelled. */
  const [edits, setEdits] = useState<Map<string, SkillsMatrixEntry>>(new Map());

  const departments = useQuery({ ...departmentsQuery(organizationId), enabled: !!org });
  const matrix = useQuery({
    ...skillsMatrixQuery(organizationId, {
      page,
      departmentId: departmentId === ALL ? undefined : departmentId,
    }),
    enabled: !!org,
  });
  useClampedPage(matrix.data?.lastPage ?? 1, page, setPage);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of matrix.data?.skills ?? []) if (s.category) set.add(s.category);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [matrix.data?.skills]);
  const skills = (matrix.data?.skills ?? []).filter(
    (s) => category === ALL || s.category === category,
  );
  const employees = matrix.data?.employees ?? [];

  const save = useMutation({
    mutationFn: () => updateSkillsMatrix([...edits.values()]),
    onSuccess: () => {
      toast.success(t("talents.skills.matrix.saved", { count: edits.size }));
      setEdits(new Map());
      return queryClient.invalidateQueries({ queryKey: [...talentsKey(organizationId), "matrix"] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const setLevel = (employeeId: string, skillId: string, level: SkillLevel | null) => {
    const saved = employees.find((e) => e.id === employeeId)?.levels[skillId] ?? null;
    setEdits((prev) => {
      const next = new Map(prev);
      const key = cellKey(employeeId, skillId);
      if (level === saved) next.delete(key);
      else next.set(key, { employeeId, skillId, level });
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          value={departmentId}
          onValueChange={(v) => {
            setDepartmentId(v);
            setPage(1);
          }}
        >
          <SelectTrigger
            className="w-full sm:w-[220px]"
            aria-label={t("talents.skills.matrix.department")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("talents.skills.matrix.allDepartments")}</SelectItem>
            {(departments.data ?? []).map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categories.length > 0 && (
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger
              className="w-full sm:w-[220px]"
              aria-label={t("talents.skills.matrix.category")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("talents.skills.matrix.allCategories")}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {matrix.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : matrix.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(matrix.error)}</p>
      ) : skills.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {editable
              ? t("talents.skills.matrix.noSkillsAdmin")
              : t("talents.skills.matrix.noSkills")}
          </CardContent>
        </Card>
      ) : employees.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {t("talents.skills.matrix.noEmployees")}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th
                      scope="col"
                      className="sticky left-0 z-10 min-w-[180px] bg-card p-3 text-left font-medium"
                    >
                      {t("talents.skills.matrix.employee")}
                    </th>
                    {skills.map((s) => (
                      <th
                        key={s.id}
                        scope="col"
                        className="min-w-[96px] p-3 text-center font-medium"
                        title={s.category ?? undefined}
                      >
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => {
                    const name = `${e.firstName} ${e.lastName}`;
                    return (
                      <tr key={e.id} className="border-b last:border-0">
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-card p-3 text-left font-normal"
                        >
                          <span className="block font-medium">{name}</span>
                          {e.jobTitle && (
                            <span className="block text-xs text-muted-foreground">
                              {e.jobTitle}
                            </span>
                          )}
                        </th>
                        {skills.map((s) => {
                          const edit = edits.get(cellKey(e.id, s.id));
                          const level = edit ? edit.level : (e.levels[s.id] ?? null);
                          return (
                            <td key={s.id} className="p-1.5 text-center">
                              <LevelCell
                                level={level}
                                changed={!!edit}
                                editable={editable}
                                label={t("talents.skills.matrix.cellLabel", {
                                  skill: s.name,
                                  name,
                                  level: level ?? t("talents.skills.matrix.notAssessed"),
                                })}
                                onChange={(l) => setLevel(e.id, s.id, l)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <ListPager page={page} lastPage={matrix.data?.lastPage ?? 1} onChange={setPage} />
      <p className="text-xs text-muted-foreground">{t("talents.skills.matrix.legend")}</p>

      {editable && edits.size > 0 && (
        <div className="sticky bottom-4 z-20 flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">{t("talents.skills.matrix.pending", { count: edits.size })}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEdits(new Map())} disabled={save.isPending}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LevelCell({
  level,
  changed,
  editable,
  label,
  onChange,
}: {
  level: number | null;
  changed: boolean;
  editable: boolean;
  label: string;
  onChange: (level: SkillLevel | null) => void;
}) {
  const { t } = useTranslation();
  const face = (
    <span
      className={cn(
        "inline-flex h-8 w-10 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
        level ? LEVEL_CLASS[level] : "border border-dashed text-muted-foreground",
        changed && "ring-2 ring-warning ring-offset-1 ring-offset-card",
      )}
    >
      {level ?? "—"}
    </span>
  );
  if (!editable) {
    return (
      <span role="img" aria-label={label} title={label}>
        {face}
      </span>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        title={label}
        className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {face}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        {SKILL_LEVELS.map((l) => (
          <DropdownMenuItem key={l} onSelect={() => onChange(l)}>
            {t("talents.skills.matrix.level", { level: l })}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onSelect={() => onChange(null)}>
          {t("talents.skills.matrix.clear")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SkillsCatalog() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const skills = useQuery({ ...skillsQuery(organizationId), enabled: !!org });
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<Skill | null>(null);
  const [removing, setRemoving] = useState<Skill | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: talentsKey(organizationId) });
  const onError = (e: unknown) => toast.error(apiErrorMessage(e));

  const add = useMutation({
    mutationFn: () => createSkill({ name: name.trim(), category: category.trim() || null }),
    onSuccess: () => {
      toast.success(t("talents.skills.catalog.added"));
      setName("");
      setCategory("");
      return refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (skill: Skill) => deleteSkill(skill.id),
    onSuccess: () => {
      toast.success(t("talents.skills.catalog.deleted"));
      setRemoving(null);
      return refresh();
    },
    onError: (e) => {
      setRemoving(null);
      onError(e);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length >= 2) add.mutate();
  };

  const rows = [...(skills.data ?? [])].sort(
    (a, b) => (a.category ?? "").localeCompare(b.category ?? "") || a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="skill-name">{t("talents.skills.catalog.name")}</Label>
              <Input
                id="skill-name"
                value={name}
                maxLength={120}
                placeholder={t("talents.skills.newSkillPlaceholder")}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="skill-category">{t("talents.skills.catalog.category")}</Label>
              <Input
                id="skill-category"
                value={category}
                maxLength={80}
                placeholder={t("talents.skills.catalog.categoryPlaceholder")}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={name.trim().length < 2 || add.isPending}>
              {add.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {t("talents.skills.add")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {skills.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : skills.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(skills.error)}</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("talents.skills.empty")}
        </p>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {rows.map((s) => (
              <div
                key={s.id}
                data-testid="skill-row"
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.category ?? t("talents.skills.catalog.noCategory")}
                  </p>
                </div>
                <ActionMenu
                  label={t("common.actions")}
                  items={[
                    {
                      label: t("common.edit"),
                      icon: <Pencil className="h-4 w-4" />,
                      onSelect: () => setEditing(s),
                    },
                    {
                      label: t("common.delete"),
                      icon: <Trash2 className="h-4 w-4" />,
                      variant: "destructive",
                      onSelect: () => setRemoving(s),
                    },
                  ]}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <EditSkillDialog skill={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(v) => !v && setRemoving(null)}
        title={t("talents.skills.catalog.deleteTitle", { name: removing?.name ?? "" })}
        description={t("talents.skills.catalog.deleteDesc")}
        actionLabel={t("common.delete")}
        actionVariant="destructive"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </div>
  );
}

function EditSkillDialog({
  skill,
  onClose,
  onSaved,
}: {
  skill: Skill | null;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: "", category: "" });
  const [current, setCurrent] = useState<string | null>(null);
  if (skill && current !== skill.id) {
    setCurrent(skill.id);
    setForm({ name: skill.name, category: skill.category ?? "" });
  }
  const save = useMutation({
    mutationFn: () =>
      updateSkill(skill!.id, { name: form.name.trim(), category: form.category.trim() || null }),
    onSuccess: async () => {
      toast.success(t("talents.skills.catalog.updated"));
      onClose();
      setCurrent(null);
      await onSaved();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Dialog
      open={!!skill}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setCurrent(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("talents.skills.catalog.editTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (form.name.trim().length >= 2) save.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="edit-skill-name">{t("talents.skills.catalog.name")}</Label>
              <Input
                id="edit-skill-name"
                value={form.name}
                maxLength={120}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-skill-category">{t("talents.skills.catalog.category")}</Label>
              <Input
                id="edit-skill-category"
                value={form.category}
                maxLength={80}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
            <DialogActions>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={form.name.trim().length < 2 || save.isPending}>
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
