import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { pendingQuery } from "@/lib/api/pending";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Mail,
  Phone,
  FileText,
  ArrowRightLeft,
  Loader2,
  MessageSquarePlus,
  Activity,
  StickyNote,
  UserPlus,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Columns3,
  TableProperties,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { useTranslation } from "react-i18next";


import { CvPreviewDialog } from "@/components/recruitment/CvPreviewDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Colour band for the match score: <40 danger, 40–69 warning, ≥70 success. */
function scoreTone(score: number): string {
  if (score >= 70) return "bg-success text-success-foreground";
  if (score >= 40) return "bg-warning text-warning-foreground";
  return "bg-destructive text-destructive-foreground";
}

function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string" && !!v.trim());
  return [];
}

export const Route = createFileRoute("/_authenticated/app/recruitment/candidates")({
  head: () => ({
    meta: [
      { title: "Candidats — Konkouré" },
      { name: "description", content: "Consultez et gérez les candidatures de votre organisation." },
      { property: "og:title", content: "Candidats — Konkouré" },
      { property: "og:description", content: "Consultez et gérez les candidatures de votre organisation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CandidatesPage,
});

const STAGES = ["new", "screening", "interview", "offer", "hired", "rejected"] as const;
type Stage = (typeof STAGES)[number];
type ViewMode = "pipeline" | "table";

const CANDIDATES_VIEW_STORAGE_KEY = "konkoure.candidates.view";

function stageLabels(t: (k: string) => string): Record<Stage, string> {
  return {
    new: t("recruitment.candidates.stages.new"),
    screening: t("recruitment.candidates.stages.screening"),
    interview: t("recruitment.candidates.stages.interview"),
    offer: t("recruitment.candidates.stages.offer"),
    hired: t("recruitment.candidates.stages.hired"),
    rejected: t("recruitment.candidates.stages.rejected"),
  };
}

const STAGE_DOT: Record<Stage, string> = {
  new: "bg-blue-500",
  screening: "bg-amber-500",
  interview: "bg-violet-500",
  offer: "bg-cyan-500",
  hired: "bg-emerald-500",
  rejected: "bg-rose-500",
};

function relativeDate(iso: string, t: (k: string, opts?: any) => string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return t("recruitment.candidates.relative.now");
  if (min < 60) return t("recruitment.candidates.relative.minutesAgo", { count: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("recruitment.candidates.relative.hoursAgo", { count: h });
  const days = Math.floor(h / 24);
  if (days < 30) return t("recruitment.candidates.relative.daysAgo", { count: days });
  const months = Math.floor(days / 30);
  if (months < 12) return t("recruitment.candidates.relative.monthsAgo", { count: months });
  return t("recruitment.candidates.relative.yearsAgo", { count: Math.floor(months / 12) });
}

type Activity = {
  id: string;
  type: "created" | "stage_changed" | "scored" | "note_added" | "note_deleted";
  payload: any;
  actor_id: string | null;
  created_at: string;
  actor_name?: string | null;
};

type Note = {
  id: string;
  body: string;
  author_id: string | null;
  created_at: string;
  author_name?: string | null;
};

function CandidatesPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const { user } = useAuth();
  const STAGE_LABELS = useMemo(() => stageLabels(t), [t]);
  const [items, setItems] = useState<any[]>([]);
  const [jobs, setJobs] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [minScore, setMinScore] = useState<string>("0");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("pipeline");
  const [openCandidate, setOpenCandidate] = useState<any | null>(null);
  const [cvPreview, setCvPreview] = useState<{ ref: string; title: string } | null>(null);


  const load = async () => {
    if (!org) return;
    setLoading(true);
    const [candidatesResult, jobsResult] = await Promise.all([
      pendingQuery("GET /org/recruitment/candidates"),
      pendingQuery("GET /org/recruitment/jobs"),
    ]);
    if (candidatesResult.error) toast.error(candidatesResult.error.message);
    if (jobsResult.error) toast.error(jobsResult.error.message);
    setItems(candidatesResult.data ?? []);
    // Published offers plus any offer that already has candidates (even if unpublished).
    const jobMap = new Map<string, string>();
    for (const j of jobsResult.data ?? []) jobMap.set(j.id, j.title);
    for (const c of candidatesResult.data ?? []) {
      const cj = (c as { jobs?: { id: string; title: string } | null }).jobs;
      if (cj?.id && !jobMap.has(cj.id)) jobMap.set(cj.id, cj.title);
    }
    setJobs(
      [...jobMap.entries()]
        .map(([id, title]) => ({ id, title }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    );
    setLoading(false);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  useEffect(() => {
    const savedView = window.localStorage.getItem(CANDIDATES_VIEW_STORAGE_KEY);
    if (savedView === "pipeline" || savedView === "table") setViewMode(savedView);
  }, []);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem(CANDIDATES_VIEW_STORAGE_KEY, mode);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ms = parseInt(minScore, 10) || 0;
    return items.filter((c) => {
      if (jobFilter !== "all" && c.jobs?.id !== jobFilter) return false;
      if (ms > 0 && (c.ai_score ?? 0) < ms) return false;
      if (stageFilter !== "all" && c.stage !== stageFilter) return false;
      if (!q) return true;
      return (
        (c.full_name ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, jobFilter, minScore, stageFilter]);

  const logActivity = async (
    candidate: any,
    type: Activity["type"],
    payload: any,
  ) => {
    if (!org || !user) return;
    await pendingQuery("POST /org/recruitment/candidates/:id/events");
  };

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const dragged = dragId ? filtered.find((x: any) => x.id === dragId) : null;
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const target = e.over?.id as Stage | undefined;
    if (!target) return;
    const c = filtered.find((x: any) => x.id === e.active.id);
    if (c && c.stage !== target) void move(c, target);
  };

  const move = async (c: any, stage: Stage) => {
    const from = c.stage as Stage;
    if (from === stage) return;
    setItems((prev) => prev.map((i) => (i.id === c.id ? { ...i, stage } : i)));
    const { error } = await pendingQuery("PATCH /org/recruitment/candidates");
    if (error) {
      toast.error(error.message);
      void load();
    } else {
      await logActivity(c, "stage_changed", { from, to: stage });
      toast.success(t("recruitment.candidates.movedTo", { stage: STAGE_LABELS[stage] }));
      if (openCandidate?.id === c.id) {
        setOpenCandidate({ ...openCandidate, stage });
      }
    }
  };

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <PageHeader title={t("recruitment.candidates.title")} description={t("recruitment.candidates.description")} />

      {/* Barre de filtres */}
      <div className="mb-4 flex w-full min-w-0 flex-wrap items-center gap-2">
        <div className="w-full min-w-0 sm:w-auto sm:min-w-[220px] sm:flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("recruitment.candidates.searchPlaceholder")}
            className="w-full"
          />
        </div>
        <Select value={jobFilter} onValueChange={setJobFilter}>
          <SelectTrigger className="w-full min-w-0 sm:w-[220px]">
            <SelectValue placeholder={t("recruitment.candidates.allJobs")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("recruitment.candidates.allJobs")}</SelectItem>
            {jobs.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={minScore} onValueChange={setMinScore}>
          <SelectTrigger className="w-full min-w-0 sm:w-[160px]">
            <SelectValue placeholder={t("recruitment.candidates.minScore")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">{t("recruitment.candidates.allScores")}</SelectItem>
            <SelectItem value="50">{t("recruitment.candidates.scoreMin", { score: 50 })}</SelectItem>
            <SelectItem value="70">{t("recruitment.candidates.scoreMin", { score: 70 })}</SelectItem>
            <SelectItem value="85">{t("recruitment.candidates.scoreMin", { score: 85 })}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-full min-w-0 sm:w-[180px]">
            <SelectValue placeholder={t("recruitment.candidates.allStages")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("recruitment.candidates.allStages")}</SelectItem>
            {STAGES.map((stage) => (
              <SelectItem key={stage} value={stage}>
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${STAGE_DOT[stage]}`} />
                  {STAGE_LABELS[stage]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TooltipProvider delayDuration={300}>
          <div
            className="flex h-10 shrink-0 items-center rounded-md border bg-background p-1"
            role="group"
            aria-label={t("recruitment.candidates.viewMode")}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant={viewMode === "pipeline" ? "secondary" : "ghost"}
                  className="h-8 w-8"
                  aria-label={t("recruitment.candidates.pipelineView")}
                  aria-pressed={viewMode === "pipeline"}
                  onClick={() => changeViewMode("pipeline")}
                >
                  <Columns3 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("recruitment.candidates.pipelineView")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  className="h-8 w-8"
                  aria-label={t("recruitment.candidates.tableView")}
                  aria-pressed={viewMode === "table"}
                  onClick={() => changeViewMode("table")}
                >
                  <TableProperties className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("recruitment.candidates.tableView")}</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
        <Badge variant="secondary" className="shrink-0 sm:ml-auto">
          {t("recruitment.candidates.candidatesCount", { count: filtered.length })}
        </Badge>
      </div>

      {viewMode === "pipeline" ? (
      /* Kanban horizontal */
      <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-4">
        <DndContext sensors={dndSensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragCancel={() => setDragId(null)} onDragEnd={onDragEnd}>
        <div className="flex w-max min-w-full gap-3 pr-1">
          {STAGES.map((s) => {
          const list = filtered.filter((i) => i.stage === s);
          return (
            <DroppableColumn key={s} id={s}>
              <CardContent className="flex h-full flex-col p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${STAGE_DOT[s]}`} />
                    <h4 className="text-sm font-semibold">{STAGE_LABELS[s]}</h4>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {list.length}
                  </Badge>
                </div>

                <div className="flex max-h-[calc(100vh-280px)] flex-col gap-2 overflow-y-auto pr-1">
                  {loading
                    ? Array.from({ length: 2 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                      ))
                    : list.length === 0
                      ? (
                        <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                          {t("recruitment.candidates.empty")}
                        </p>
                      )
                      : list.map((c) => (
                          <DraggableCard key={c.id} id={c.id}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setOpenCandidate(c)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setOpenCandidate(c);
                              }
                            }}
                            className="cursor-pointer rounded-lg border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >

                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{c.full_name}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {c.jobs?.title ?? "—"}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                {c.cv_url && (
                                  <button
                                    type="button"
                                    title={t("recruitment.candidates.viewCv")}
                                    aria-label={t("recruitment.candidates.viewCv")}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCvPreview({ ref: c.cv_url, title: c.full_name });
                                    }}
                                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </button>
                                )}
                                {c.ai_score != null && (
                                  <Badge
                                    className={`shrink-0 border-transparent tabular-nums ${scoreTone(c.ai_score)}`}
                                    title={t("recruitment.candidates.aiScoreLabel", { score: c.ai_score })}
                                    aria-label={t("recruitment.candidates.aiScoreLabel", { score: c.ai_score })}
                                  >
                                    {c.ai_score}/100
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {(c.ai_is_valid_cv === false || c.ai_fraud_alert === true) && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {c.ai_is_valid_cv === false && (
                                  <Badge variant="destructive" className="gap-1 text-[10px]">
                                    <AlertTriangle className="h-3 w-3" />
                                    {t("recruitment.candidates.invalidCv")}
                                  </Badge>
                                )}
                                {c.ai_fraud_alert === true && (
                                  <Badge variant="destructive" className="gap-1 text-[10px]">
                                    <ShieldAlert className="h-3 w-3" />
                                    {t("recruitment.candidates.fraudAlert")}
                                  </Badge>
                                )}
                              </div>
                            )}


                            <div className="mt-2 space-y-1">
                              {c.email && (
                                <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                                  <Mail className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{c.email}</span>
                                </span>
                              )}
                              {c.phone && (
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Phone className="h-3 w-3 shrink-0" />
                                  {c.phone}
                                </span>
                              )}
                            </div>

                            <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                              {relativeDate(c.created_at, t)}
                            </p>

                            <div
                              className="mt-2 flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ArrowRightLeft className="mr-1 h-3 w-3" />
                                    {t("recruitment.candidates.move")}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {STAGES.filter((x) => x !== s).map((x) => (
                                    <DropdownMenuItem
                                      key={x}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void move(c, x);
                                      }}
                                    >
                                      <span
                                        className={`mr-2 h-2 w-2 rounded-full ${STAGE_DOT[x]}`}
                                      />
                                      {STAGE_LABELS[x]}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          </DraggableCard>
                        ))}
                </div>
              </CardContent>
            </DroppableColumn>
          );
          })}
        </div>
        <DragOverlay>
          {dragged ? (
            <div className="w-[276px] rotate-2 rounded-lg border border-primary bg-card p-3 shadow-lg">
              <p className="truncate text-sm font-medium">{dragged.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{dragged.jobs?.title ?? "—"}</p>
            </div>
          ) : null}
        </DragOverlay>
        </DndContext>
      </div>
      ) : (
        <div className="w-full min-w-0 max-w-full overflow-hidden rounded-md border bg-card">
          <Table className="min-w-[1280px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">{t("recruitment.candidates.table.fullName")}</TableHead>
                <TableHead className="w-[130px]">{t("recruitment.candidates.table.phone")}</TableHead>
                <TableHead className="w-[180px]">{t("recruitment.candidates.table.profile")}</TableHead>
                <TableHead className="w-[100px]">{t("recruitment.candidates.table.score")}</TableHead>
                <TableHead className="w-[260px]">{t("recruitment.candidates.table.justification")}</TableHead>
                <TableHead className="w-[260px]">{t("recruitment.candidates.table.strengths")}</TableHead>
                <TableHead className="w-[190px]">{t("recruitment.candidates.table.stage")}</TableHead>
                <TableHead className="w-[72px] text-center">{t("recruitment.candidates.table.cv")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`candidate-table-skeleton-${index}`}>
                  {Array.from({ length: 8 }).map((__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    {t("recruitment.candidates.empty")}
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.map((candidate) => {
                const strengths = toList(candidate.ai_strengths);
                return (
                  <TableRow
                    key={candidate.id}
                    className="cursor-pointer"
                    onClick={() => setOpenCandidate(candidate)}
                  >
                    <TableCell className="font-medium">
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto max-w-full justify-start p-0 text-left text-foreground"
                        onClick={() => setOpenCandidate(candidate)}
                      >
                        <span className="truncate">{candidate.full_name}</span>
                      </Button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{candidate.phone || "—"}</TableCell>
                    <TableCell>
                      <span className="line-clamp-2">{candidate.jobs?.title ?? "—"}</span>
                    </TableCell>
                    <TableCell>
                      {candidate.ai_score == null ? (
                        <span className="text-xs text-muted-foreground">
                          {t("recruitment.candidates.notAnalyzed")}
                        </span>
                      ) : (
                        <Badge className={`border-transparent tabular-nums ${scoreTone(candidate.ai_score)}`}>
                          {candidate.ai_score}/100
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        {candidate.ai_justification || "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      {strengths.length === 0 ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <p className="line-clamp-3 text-sm text-muted-foreground">
                          {strengths.join(" • ")}
                        </p>
                      )}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Select
                        value={candidate.stage}
                        onValueChange={(stage) => void move(candidate, stage as Stage)}
                      >
                        <SelectTrigger
                          className="h-9 w-full min-w-0"
                          aria-label={t("recruitment.candidates.changeStageFor", {
                            name: candidate.full_name,
                          })}
                        >
                          <SelectValue>
                            <span className="flex min-w-0 items-center gap-2">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${STAGE_DOT[candidate.stage as Stage]}`}
                              />
                              <span className="truncate">
                                {STAGE_LABELS[candidate.stage as Stage]}
                              </span>
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STAGES.map((stage) => (
                            <SelectItem key={stage} value={stage}>
                              <span className="flex items-center gap-2">
                                <span
                                  className={`h-2 w-2 shrink-0 rounded-full ${STAGE_DOT[stage]}`}
                                />
                                {STAGE_LABELS[stage]}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      {candidate.cv_url ? (
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label={t("recruitment.candidates.viewCv")}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setCvPreview({ ref: candidate.cv_url, title: candidate.full_name });
                                }}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("recruitment.candidates.viewCv")}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CandidateDetailDialog
        candidate={openCandidate}
        onClose={() => setOpenCandidate(null)}
        onMove={(stage) => openCandidate && move(openCandidate, stage)}
        currentUserId={user?.id ?? null}
        onPreviewCv={(ref, title) => setCvPreview({ ref, title })}
      />

      <CvPreviewDialog
        fileRef={cvPreview?.ref ?? null}
        title={cvPreview?.title ?? null}
        onClose={() => setCvPreview(null)}
      />
    </div>
  );
}

// =============================================
// Modale détail candidat
// =============================================

function CandidateDetailDialog({
  candidate,
  onClose,
  onMove,
  currentUserId,
  onPreviewCv,
}: {
  candidate: any | null;
  onClose: () => void;
  onMove: (stage: Stage) => void;
  currentUserId: string | null;
  onPreviewCv: (ref: string, title: string) => void;
}) {
  const { t } = useTranslation();
  const { org } = useOrg();
  const STAGE_LABELS = useMemo(() => stageLabels(t), [t]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [loading, setLoading] = useState(false);

  const open = !!candidate;

  useEffect(() => {
    if (!candidate) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [act, nts] = await Promise.all([
        pendingQuery("GET /org/recruitment/candidates/:id/events"),
        pendingQuery("GET /org/recruitment/candidates/:id/notes"),
      ]);

      // Récupérer les noms d'auteur/acteur
      const actorIds = new Set<string>();
      (act.data ?? []).forEach((a: any) => a.actor_id && actorIds.add(a.actor_id));
      (nts.data ?? []).forEach((n: any) => n.author_id && actorIds.add(n.author_id));
      let profileMap = new Map<string, string>();
      if (actorIds.size > 0) {
        const { data: profs } = await pendingQuery("GET /me");
        profileMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name ?? ""]));
      }

      if (cancelled) return;
      setActivities(
        (act.data ?? []).map((a: any) => ({
          ...a,
          actor_name: a.actor_id ? profileMap.get(a.actor_id) ?? null : null,
        })),
      );
      setNotes(
        (nts.data ?? []).map((n: any) => ({
          ...n,
          author_name: n.author_id ? profileMap.get(n.author_id) ?? null : null,
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [candidate?.id]);

  const addNote = async () => {
    if (!candidate || !org || !currentUserId) return;
    const body = noteDraft.trim();
    if (!body) return;
    setSavingNote(true);
    const { data, error } = await pendingQuery("POST /org/recruitment/candidates/:id/notes");
    if (error) {
      toast.error(error.message);
      setSavingNote(false);
      return;
    }
    await pendingQuery("POST /org/recruitment/candidates/:id/events");
    setNoteDraft("");
    setSavingNote(false);
    // Recharge léger
    const [act, nts] = await Promise.all([
      pendingQuery("GET /org/recruitment/candidates/:id/events"),
      pendingQuery("GET /org/recruitment/candidates/:id/notes"),
    ]);
    const actorIds = new Set<string>();
    (act.data ?? []).forEach((a: any) => a.actor_id && actorIds.add(a.actor_id));
    (nts.data ?? []).forEach((n: any) => n.author_id && actorIds.add(n.author_id));
    let profileMap = new Map<string, string>();
    if (actorIds.size > 0) {
      const { data: profs } = await pendingQuery("GET /me");
      profileMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name ?? ""]));
    }
    setActivities(
      (act.data ?? []).map((a: any) => ({
        ...a,
        actor_name: a.actor_id ? profileMap.get(a.actor_id) ?? null : null,
      })),
    );
    setNotes(
      (nts.data ?? []).map((n: any) => ({
        ...n,
        author_name: n.author_id ? profileMap.get(n.author_id) ?? null : null,
      })),
    );
    toast.success(t("recruitment.candidates.noteAdded"));
  };

  const deleteNote = async (n: Note) => {
    if (!candidate || !org) return;
    const { error } = await pendingQuery("DELETE /org/recruitment/candidates/:id/notes");
    if (error) return toast.error(error.message);
    await pendingQuery("POST /org/recruitment/candidates/:id/events");
    setNotes((prev) => prev.filter((x) => x.id !== n.id));
    // Refresh activities
    const { data: act } = await pendingQuery("GET /org/recruitment/candidates/:id/events");
    const actorIds = new Set<string>();
    (act ?? []).forEach((a: any) => a.actor_id && actorIds.add(a.actor_id));
    let profileMap = new Map<string, string>();
    if (actorIds.size > 0) {
      const { data: profs } = await pendingQuery("GET /me");
      profileMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name ?? ""]));
    }
    setActivities(
      (act ?? []).map((a: any) => ({
        ...a,
        actor_name: a.actor_id ? profileMap.get(a.actor_id) ?? null : null,
      })),
    );
  };

  if (!candidate) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{candidate.full_name}</span>
            <Badge variant="outline" className="font-normal">
              <span
                className={`mr-1.5 h-2 w-2 rounded-full ${STAGE_DOT[candidate.stage as Stage]}`}
              />
              {STAGE_LABELS[candidate.stage as Stage]}
            </Badge>
            {candidate.ai_score != null && (
              <Badge className={`border-transparent ${scoreTone(candidate.ai_score)}`}>
                {t("recruitment.candidates.aiScoreLabel", { score: candidate.ai_score })}
              </Badge>
            )}
            {candidate.ai_is_valid_cv === false && (
              <Badge variant="destructive" className="gap-1 font-normal">
                <AlertTriangle className="h-3 w-3" />
                {t("recruitment.candidates.invalidCv")}
              </Badge>
            )}
            {candidate.ai_fraud_alert === true && (
              <Badge variant="destructive" className="gap-1 font-normal">
                <ShieldAlert className="h-3 w-3" />
                {t("recruitment.candidates.fraudAlert")}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Colonne gauche : infos + notes */}
            <div className="space-y-5">
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("recruitment.candidates.contactInfo")}
                </h3>
                <div className="space-y-1.5 text-sm">
                  <p className="text-muted-foreground">
                    {t("recruitment.candidates.job")}{" "}
                    <span className="text-foreground">{candidate.jobs?.title ?? "—"}</span>
                  </p>
                  {candidate.email && (
                    <a
                      href={`mailto:${candidate.email}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Mail className="h-4 w-4 text-muted-foreground" /> {candidate.email}
                    </a>
                  )}
                  {candidate.phone && (
                    <a
                      href={`tel:${candidate.phone}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Phone className="h-4 w-4 text-muted-foreground" /> {candidate.phone}
                    </a>
                  )}
                  {candidate.cv_url && (
                    <button
                      type="button"
                      onClick={() => onPreviewCv(candidate.cv_url, candidate.full_name)}
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Eye className="h-4 w-4" /> {t("recruitment.candidates.viewCv")}
                    </button>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("recruitment.candidates.matchScore")}
                  </h3>
                  {candidate.ai_scored_at && (
                    <span className="text-xs text-muted-foreground">
                      {t("recruitment.candidates.scoredAt", {
                        date: relativeDate(candidate.ai_scored_at, t),
                      })}
                    </span>
                  )}
                </div>

                {candidate.ai_score == null ? (
                  <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                    {t("recruitment.candidates.noAnalysis")}
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold ${scoreTone(candidate.ai_score)}`}
                      >
                        {candidate.ai_score}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${scoreTone(candidate.ai_score)}`}
                          style={{ width: `${Math.min(100, Math.max(0, candidate.ai_score))}%` }}
                        />
                      </div>
                    </div>

                    {candidate.ai_justification && (
                      <p className="whitespace-pre-line rounded-md bg-muted/50 p-3 text-sm">
                        {candidate.ai_justification}
                      </p>
                    )}

                    {toList(candidate.ai_strengths).length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-success">
                          <ThumbsUp className="h-3.5 w-3.5" />
                          {t("recruitment.candidates.strengths")}
                        </h4>
                        <ul className="list-disc space-y-1 pl-5 text-sm">
                          {toList(candidate.ai_strengths).map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {toList(candidate.ai_weaknesses).length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                          <ThumbsDown className="h-3.5 w-3.5" />
                          {t("recruitment.candidates.weaknesses")}
                        </h4>
                        <ul className="list-disc space-y-1 pl-5 text-sm">
                          {toList(candidate.ai_weaknesses).map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </section>


              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("recruitment.candidates.actions")}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        <ArrowRightLeft className="mr-1.5 h-4 w-4" />
                        {t("recruitment.candidates.moveTo")}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {STAGES.filter((x) => x !== candidate.stage).map((x) => (
                        <DropdownMenuItem key={x} onClick={() => onMove(x)}>
                          <span
                            className={`mr-2 h-2 w-2 rounded-full ${STAGE_DOT[x]}`}
                          />
                          {STAGE_LABELS[x]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <StickyNote className="h-3.5 w-3.5" /> {t("recruitment.candidates.internalNotes")}
                </h3>
                <div className="space-y-2">
                  <Textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder={t("recruitment.candidates.addNotePlaceholder")}
                    rows={3}
                  />
                  <Button
                    size="sm"
                    onClick={addNote}
                    disabled={savingNote || !noteDraft.trim()}
                  >
                    {savingNote ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <MessageSquarePlus className="mr-1.5 h-4 w-4" />
                    )}
                    {t("recruitment.candidates.addNote")}
                  </Button>
                </div>
                <div className="space-y-2 pt-1">
                  {notes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("recruitment.candidates.noNotes")}</p>
                  ) : (
                    notes.map((n) => (
                      <div key={n.id} className="rounded-md border bg-card p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {n.author_name ?? t("recruitment.candidates.anonymous")} • {relativeDate(n.created_at, t)}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
                          </div>
                          {n.author_id === currentUserId && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0"
                              onClick={() => deleteNote(n)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            {/* Colonne droite : journal */}
            <div className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Activity className="h-3.5 w-3.5" /> {t("recruitment.candidates.activityLog")}
              </h3>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  {t("recruitment.candidates.noActivity")}
                </p>
              ) : (
                <ol className="relative space-y-3 border-l pl-4">
                  {activities.map((a) => (
                    <ActivityItem key={a.id} activity={a} stageLabels={STAGE_LABELS} />
                  ))}
                </ol>
              )}
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function ActivityItem({ activity, stageLabels }: { activity: Activity; stageLabels: Record<Stage, string> }) {
  const { t, i18n } = useTranslation();
  const { icon, label } = describeActivity(activity, t, stageLabels);
  const exact = new Date(activity.created_at).toLocaleString(i18n.language.startsWith("en") ? "en-GB" : "fr-FR");
  return (
    <li className="relative">
      <span className="absolute -left-[26px] flex h-5 w-5 items-center justify-center rounded-full border bg-background text-muted-foreground">
        {icon}
      </span>
      <p className="text-sm">{label}</p>
      <p className="text-xs text-muted-foreground" title={exact}>
        {activity.actor_name ?? t("recruitment.candidates.system")} • {relativeDate(activity.created_at, t)}
      </p>
    </li>
  );
}

function describeActivity(
  a: Activity,
  t: (k: string, opts?: any) => string,
  stageLabels: Record<Stage, string>,
): { icon: ReactNode; label: string } {
  const p = a.payload ?? {};
  switch (a.type) {
    case "created":
      return {
        icon: <UserPlus className="h-3 w-3" />,
        label: p.job_title
          ? t("recruitment.candidates.activityDescriptions.createdWithJob", { job: p.job_title })
          : t("recruitment.candidates.activityDescriptions.created"),
      };
    case "stage_changed":
      return {
        icon: <ArrowRightLeft className="h-3 w-3" />,
        label: t("recruitment.candidates.activityDescriptions.stageChanged", {
          from: stageLabels[p.from as Stage] ?? p.from,
          to: stageLabels[p.to as Stage] ?? p.to,
        }),
      };
    case "scored":
      return {
        icon: <Sparkles className="h-3 w-3" />,
        label: t("recruitment.candidates.activityDescriptions.scored", { score: p.score }),
      };
    case "note_added":
      return {
        icon: <StickyNote className="h-3 w-3" />,
        label: p.excerpt
          ? t("recruitment.candidates.activityDescriptions.noteAdded", {
              excerpt: `${p.excerpt}${p.excerpt.length >= 120 ? "…" : ""}`,
            })
          : t("recruitment.candidates.activityDescriptions.noteAddedNoExcerpt"),
      };
    case "note_deleted":
      return {
        icon: <Trash2 className="h-3 w-3" />,
        label: t("recruitment.candidates.activityDescriptions.noteDeleted"),
      };
    default:
      return { icon: <Activity className="h-3 w-3" />, label: a.type };
  }
}

function DroppableColumn({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <Card
      ref={setNodeRef}
      className={`flex w-[300px] shrink-0 flex-col transition-colors ${
        isOver ? "border-primary bg-primary/10" : "bg-muted/30"
      }`}
    >
      {children}
    </Card>
  );
}

function DraggableCard({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role={undefined}
      tabIndex={-1}
      style={{
        touchAction: "manipulation",
      }}
      className={isDragging ? "opacity-40" : undefined}
    >
      {children}
    </div>
  );
}
