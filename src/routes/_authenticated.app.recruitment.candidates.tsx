import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { apiErrorMessage, newIdempotencyKey } from "@/lib/api/client";
import {
  addCandidateNote,
  allJobsQuery,
  CANDIDATE_STAGES,
  candidateEventsQuery,
  candidateNotesQuery,
  candidatesQuery,
  deleteCandidateNote,
  hireCandidate,
  moveCandidate,
  recruitmentKey,
  type Candidate,
  type CandidateEvent,
  type CandidateNote,
  type CandidateStage,
} from "@/lib/api/recruitment";
import { hrKey } from "@/lib/api/hr";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogActions,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { CvPreviewDialog, type CandidateFile } from "@/components/recruitment/CvPreviewDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Colour band for the match score: <40 danger, 40–69 warning, ≥70 success. */
function scoreTone(score: number): string {
  if (score >= 70) return "bg-success text-success-foreground";
  if (score >= 40) return "bg-warning text-warning-foreground";
  return "bg-destructive text-destructive-foreground";
}

const toList = (value: string[] | null) => (value ?? []).filter((v) => !!v.trim());

export const Route = createFileRoute("/_authenticated/app/recruitment/candidates")({
  head: () => ({
    meta: [
      { title: "Candidats — Konkouré" },
      {
        name: "description",
        content: "Consultez et gérez les candidatures de votre organisation.",
      },
      { property: "og:title", content: "Candidats — Konkouré" },
      {
        property: "og:description",
        content: "Consultez et gérez les candidatures de votre organisation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CandidatesPage,
});

const STAGES = CANDIDATE_STAGES;
type Stage = CandidateStage;
type ViewMode = "pipeline" | "table";
type Preview = { file: CandidateFile; title: string };

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

function relativeDate(iso: string, t: (k: string, opts?: Record<string, unknown>) => string) {
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

const hasCv = (c: Candidate) => c.documents.includes("cv");

function CandidatesPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const STAGE_LABELS = useMemo(() => stageLabels(t), [t]);
  const candidates = useQuery({ ...candidatesQuery(organizationId), enabled: !!org });
  const allJobs = useQuery({ ...allJobsQuery(organizationId), enabled: !!org });
  const loading = candidates.isPending;
  const items = useMemo(() => candidates.data ?? [], [candidates.data]);

  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [minScore, setMinScore] = useState<string>("0");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("pipeline");
  const [openId, setOpenId] = useState<string | null>(null);
  const [hiring, setHiring] = useState<Candidate | null>(null);
  const [cvPreview, setCvPreview] = useState<Preview | null>(null);
  const openCandidate = openId ? (items.find((c) => c.id === openId) ?? null) : null;

  // Every offer, plus any offer a candidate still points to.
  const jobs = useMemo(() => {
    const map = new Map<string, string>();
    for (const j of allJobs.data ?? []) map.set(j.id, j.title);
    for (const c of items) if (c.jobTitle && !map.has(c.jobId)) map.set(c.jobId, c.jobTitle);
    return [...map.entries()]
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [allJobs.data, items]);

  useEffect(() => {
    try {
      const savedView = window.localStorage.getItem(CANDIDATES_VIEW_STORAGE_KEY);
      if (savedView === "pipeline" || savedView === "table") setViewMode(savedView);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      window.localStorage.setItem(CANDIDATES_VIEW_STORAGE_KEY, mode);
    } catch {
      /* storage unavailable */
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ms = parseInt(minScore, 10) || 0;
    return items.filter((c) => {
      if (jobFilter !== "all" && c.jobId !== jobFilter) return false;
      if (ms > 0 && (c.aiScore ?? 0) < ms) return false;
      if (stageFilter !== "all" && c.stage !== stageFilter) return false;
      if (!q) return true;
      return c.fullName.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q);
    });
  }, [items, search, jobFilter, minScore, stageFilter]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: recruitmentKey(organizationId) });

  const moveMutation = useMutation({
    mutationFn: ({ c, stage }: { c: Candidate; stage: Stage }) => moveCandidate(c.id, stage),
    onSuccess: (_, { stage }) => {
      toast.success(t("recruitment.candidates.movedTo", { stage: STAGE_LABELS[stage] }));
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
    onSettled: refresh,
  });

  /** `hired` creates the employee record through `/hire`, never `/stage` (06 §8). */
  const move = (c: Candidate, stage: Stage) => {
    if (c.stage === stage) return;
    if (stage === "hired") {
      setHiring(c);
      return;
    }
    moveMutation.mutate({ c, stage });
  };

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const dragged = dragId ? filtered.find((x) => x.id === dragId) : null;
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const target = e.over?.id as Stage | undefined;
    if (!target) return;
    const c = filtered.find((x) => x.id === e.active.id);
    if (c && c.stage !== target) move(c, target);
  };

  const previewCv = (c: Candidate) =>
    setCvPreview({ file: { candidateId: c.id, key: "cv" }, title: c.fullName });

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <PageHeader
        title={t("recruitment.candidates.title")}
        description={t("recruitment.candidates.description")}
      />

      {/* Barre de filtres */}
      <div className="mb-4 flex w-full min-w-0 flex-wrap items-center gap-2">
        <div className="w-full min-w-0 sm:w-auto sm:min-w-[220px] sm:flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("recruitment.candidates.searchPlaceholder")}
            aria-label={t("recruitment.candidates.searchPlaceholder")}
            className="w-full"
          />
        </div>
        <Select value={jobFilter} onValueChange={setJobFilter}>
          <SelectTrigger
            className="w-full min-w-0 sm:w-[220px]"
            aria-label={t("recruitment.candidates.allJobs")}
          >
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
          <SelectTrigger
            className="w-full min-w-0 sm:w-[160px]"
            aria-label={t("recruitment.candidates.minScore")}
          >
            <SelectValue placeholder={t("recruitment.candidates.minScore")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">{t("recruitment.candidates.allScores")}</SelectItem>
            <SelectItem value="50">
              {t("recruitment.candidates.scoreMin", { score: 50 })}
            </SelectItem>
            <SelectItem value="70">
              {t("recruitment.candidates.scoreMin", { score: 70 })}
            </SelectItem>
            <SelectItem value="85">
              {t("recruitment.candidates.scoreMin", { score: 85 })}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger
            className="w-full min-w-0 sm:w-[180px]"
            aria-label={t("recruitment.candidates.allStages")}
          >
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

      {candidates.isError && (
        <p className="mb-4 text-center text-sm text-destructive">
          {apiErrorMessage(candidates.error)}
        </p>
      )}

      {viewMode === "pipeline" ? (
        /* Kanban horizontal */
        <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-4">
          <DndContext
            sensors={dndSensors}
            onDragStart={(e) => setDragId(String(e.active.id))}
            onDragCancel={() => setDragId(null)}
            onDragEnd={onDragEnd}
          >
            <div className="flex w-max min-w-full gap-3 pr-1">
              {STAGES.map((s) => {
                const list = filtered.filter((i) => i.stage === s);
                return (
                  <DroppableColumn key={s} id={s} label={STAGE_LABELS[s]}>
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
                        {loading ? (
                          Array.from({ length: 2 }).map((_, i) => (
                            <Skeleton key={i} className="h-24 w-full" />
                          ))
                        ) : list.length === 0 ? (
                          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                            {t("recruitment.candidates.empty")}
                          </p>
                        ) : (
                          list.map((c) => (
                            <DraggableCard key={c.id} id={c.id}>
                              <div
                                role="button"
                                tabIndex={0}
                                data-testid="candidate-card"
                                onClick={() => setOpenId(c.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setOpenId(c.id);
                                  }
                                }}
                                className="cursor-pointer rounded-lg border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{c.fullName}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {c.jobTitle ?? "—"}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    {hasCv(c) && (
                                      <button
                                        type="button"
                                        title={t("recruitment.candidates.viewCv")}
                                        aria-label={t("recruitment.candidates.viewCv")}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          previewCv(c);
                                        }}
                                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                      >
                                        <FileText className="h-4 w-4" />
                                      </button>
                                    )}
                                    {c.aiScore != null && (
                                      <Badge
                                        className={`shrink-0 border-transparent tabular-nums ${scoreTone(c.aiScore)}`}
                                        title={t("recruitment.candidates.aiScoreLabel", {
                                          score: c.aiScore,
                                        })}
                                        aria-label={t("recruitment.candidates.aiScoreLabel", {
                                          score: c.aiScore,
                                        })}
                                      >
                                        {c.aiScore}/100
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                {(c.aiIsValidCv === false || c.aiFraudAlert === true) && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {c.aiIsValidCv === false && (
                                      <Badge variant="destructive" className="gap-1 text-[10px]">
                                        <AlertTriangle className="h-3 w-3" />
                                        {t("recruitment.candidates.invalidCv")}
                                      </Badge>
                                    )}
                                    {c.aiFraudAlert === true && (
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
                                  {relativeDate(c.createdAt, t)}
                                </p>

                                {c.stage !== "hired" && (
                                  <div
                                    className="mt-2 flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <StageMenu
                                      current={c.stage}
                                      labels={STAGE_LABELS}
                                      onSelect={(x) => move(c, x)}
                                    >
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-xs"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ArrowRightLeft className="mr-1 h-3 w-3" />
                                        {t("recruitment.candidates.move")}
                                      </Button>
                                    </StageMenu>
                                  </div>
                                )}
                              </div>
                            </DraggableCard>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </DroppableColumn>
                );
              })}
            </div>
            <DragOverlay>
              {dragged ? (
                <div className="w-[276px] rotate-2 rounded-lg border border-primary bg-card p-3 shadow-lg">
                  <p className="truncate text-sm font-medium">{dragged.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {dragged.jobTitle ?? "—"}
                  </p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      ) : (
        <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-md border bg-card">
          <Table className="min-w-[1280px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">
                  {t("recruitment.candidates.table.fullName")}
                </TableHead>
                <TableHead className="w-[130px]">
                  {t("recruitment.candidates.table.phone")}
                </TableHead>
                <TableHead className="w-[180px]">
                  {t("recruitment.candidates.table.profile")}
                </TableHead>
                <TableHead className="w-[100px]">
                  {t("recruitment.candidates.table.score")}
                </TableHead>
                <TableHead className="w-[260px]">
                  {t("recruitment.candidates.table.justification")}
                </TableHead>
                <TableHead className="w-[260px]">
                  {t("recruitment.candidates.table.strengths")}
                </TableHead>
                <TableHead className="w-[190px]">
                  {t("recruitment.candidates.table.stage")}
                </TableHead>
                <TableHead className="w-[72px] text-center">
                  {t("recruitment.candidates.table.cv")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 5 }).map((_, index) => (
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
              {!loading &&
                filtered.map((candidate) => {
                  const strengths = toList(candidate.aiStrengths);
                  return (
                    <TableRow
                      key={candidate.id}
                      className="cursor-pointer"
                      onClick={() => setOpenId(candidate.id)}
                    >
                      <TableCell className="font-medium">
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto max-w-full justify-start p-0 text-left text-foreground"
                          onClick={() => setOpenId(candidate.id)}
                        >
                          <span className="truncate">{candidate.fullName}</span>
                        </Button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{candidate.phone || "—"}</TableCell>
                      <TableCell>
                        <span className="line-clamp-2">{candidate.jobTitle ?? "—"}</span>
                      </TableCell>
                      <TableCell>
                        {candidate.aiScore == null ? (
                          <span className="text-xs text-muted-foreground">
                            {t("recruitment.candidates.notAnalyzed")}
                          </span>
                        ) : (
                          <Badge
                            className={`border-transparent tabular-nums ${scoreTone(candidate.aiScore)}`}
                          >
                            {candidate.aiScore}/100
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="line-clamp-3 text-sm text-muted-foreground">
                          {candidate.aiJustification || "—"}
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
                          disabled={candidate.stage === "hired"}
                          onValueChange={(stage) => move(candidate, stage as Stage)}
                        >
                          <SelectTrigger
                            className="h-9 w-full min-w-0"
                            aria-label={t("recruitment.candidates.changeStageFor", {
                              name: candidate.fullName,
                            })}
                          >
                            <SelectValue>
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  className={`h-2 w-2 shrink-0 rounded-full ${STAGE_DOT[candidate.stage]}`}
                                />
                                <span className="truncate">{STAGE_LABELS[candidate.stage]}</span>
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
                        {hasCv(candidate) ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={t("recruitment.candidates.viewCv")}
                            onClick={(event) => {
                              event.stopPropagation();
                              previewCv(candidate);
                            }}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
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
        onClose={() => setOpenId(null)}
        onMove={(stage) => openCandidate && move(openCandidate, stage)}
        onPreview={setCvPreview}
      />

      <HireDialog
        candidate={hiring}
        onClose={() => setHiring(null)}
        onHired={() => {
          setHiring(null);
          void refresh();
          void queryClient.invalidateQueries({ queryKey: hrKey(organizationId) });
        }}
      />

      <CvPreviewDialog
        file={cvPreview?.file ?? null}
        title={cvPreview?.title ?? null}
        onClose={() => setCvPreview(null)}
      />
    </div>
  );
}

function StageMenu({
  current,
  labels,
  onSelect,
  children,
}: {
  current: Stage;
  labels: Record<Stage, string>;
  onSelect: (stage: Stage) => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {STAGES.filter((x) => x !== current).map((x) => (
          <DropdownMenuItem key={x} onClick={() => onSelect(x)}>
            <span className={`mr-2 h-2 w-2 rounded-full ${STAGE_DOT[x]}`} />
            {labels[x]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =============================================
// Embauche : crée la fiche employé (06 §8)
// =============================================

function HireDialog({
  candidate,
  onClose,
  onHired,
}: {
  candidate: Candidate | null;
  onClose: () => void;
  onHired: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: "", lastName: "", hireDate: "" });
  const [key, setKey] = useState(newIdempotencyKey);

  useEffect(() => {
    if (!candidate) return;
    const [first, ...rest] = candidate.fullName.trim().split(/\s+/);
    setForm({
      firstName: first ?? "",
      lastName: rest.join(" ") || first || "",
      hireDate: new Date().toISOString().slice(0, 10),
    });
    setKey(newIdempotencyKey());
  }, [candidate]);

  const hire = useMutation({
    mutationFn: () =>
      hireCandidate(
        candidate!.id,
        {
          firstName: form.firstName.trim() || undefined,
          lastName: form.lastName.trim() || undefined,
          hireDate: form.hireDate || undefined,
        },
        key,
      ),
    onSuccess: ({ employeeId }) => {
      toast.success(t("recruitment.candidates.hiredSuccess"), {
        action: {
          label: t("recruitment.candidates.openEmployee"),
          onClick: () => void navigate({ to: "/app/employees/$id", params: { id: employeeId } }),
        },
      });
      onHired();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <Dialog open={!!candidate} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("recruitment.candidates.hireTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-muted-foreground">
            {t("recruitment.candidates.hireDesc", { name: candidate?.fullName ?? "" })}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="hire-first">{t("recruitment.candidates.firstName")}</Label>
              <Input
                id="hire-first"
                value={form.firstName}
                maxLength={100}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="hire-last">{t("recruitment.candidates.lastName")}</Label>
              <Input
                id="hire-last"
                value={form.lastName}
                maxLength={100}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="hire-date">{t("recruitment.candidates.hireDate")}</Label>
              <Input
                id="hire-date"
                type="date"
                value={form.hireDate}
                onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
              />
            </div>
          </div>
          <DialogActions>
            <Button variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => hire.mutate()} disabled={hire.isPending}>
              {hire.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <UserCheck className="mr-1.5 h-4 w-4" />
              )}
              {t("recruitment.candidates.hire")}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// Modale détail candidat
// =============================================

function CandidateDetailDialog({
  candidate,
  onClose,
  onMove,
  onPreview,
}: {
  candidate: Candidate | null;
  onClose: () => void;
  onMove: (stage: Stage) => void;
  onPreview: (preview: Preview) => void;
}) {
  const { t } = useTranslation();
  const { org } = useOrg();
  const { user, me } = useAuth();
  const { isAdmin } = useRole();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const STAGE_LABELS = useMemo(() => stageLabels(t), [t]);
  const [noteDraft, setNoteDraft] = useState("");
  const id = candidate?.id ?? "";
  const notes = useQuery({ ...candidateNotesQuery(organizationId, id), enabled: !!candidate });
  const events = useQuery({ ...candidateEventsQuery(organizationId, id), enabled: !!candidate });

  // The API gives user ids only: the reader, or another member of the team.
  const actorName = (actorId: string | null) => {
    if (!actorId) return null;
    if (actorId === user?.id) return me?.user.fullName || t("recruitment.candidates.you");
    return t("recruitment.candidates.teamMember");
  };

  const refreshDetail = () =>
    queryClient.invalidateQueries({
      queryKey: [...recruitmentKey(organizationId), "candidates", id],
    });

  const addNote = useMutation({
    mutationFn: (body: string) => addCandidateNote(id, body),
    onSuccess: () => {
      setNoteDraft("");
      toast.success(t("recruitment.candidates.noteAdded"));
      return refreshDetail();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const deleteNote = useMutation({
    mutationFn: (n: CandidateNote) => deleteCandidateNote(id, n.id),
    onSuccess: refreshDetail,
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  useEffect(() => setNoteDraft(""), [id]);

  if (!candidate) return null;
  const pieces = candidate.documents.filter((k) => k !== "cv");

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            <span>{candidate.fullName}</span>
            <Badge variant="outline" className="font-normal">
              <span className={`mr-1.5 h-2 w-2 rounded-full ${STAGE_DOT[candidate.stage]}`} />
              {STAGE_LABELS[candidate.stage]}
            </Badge>
            {candidate.aiScore != null && (
              <Badge className={`border-transparent ${scoreTone(candidate.aiScore)}`}>
                {t("recruitment.candidates.aiScoreLabel", { score: candidate.aiScore })}
              </Badge>
            )}
            {candidate.aiIsValidCv === false && (
              <Badge variant="destructive" className="gap-1 font-normal">
                <AlertTriangle className="h-3 w-3" />
                {t("recruitment.candidates.invalidCv")}
              </Badge>
            )}
            {candidate.aiFraudAlert === true && (
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
                    <span className="text-foreground">{candidate.jobTitle ?? "—"}</span>
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
                      href={`tel:${candidate.phone.replace(/\s/g, "")}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Phone className="h-4 w-4 text-muted-foreground" /> {candidate.phone}
                    </a>
                  )}
                  {hasCv(candidate) && (
                    <button
                      type="button"
                      onClick={() =>
                        onPreview({
                          file: { candidateId: candidate.id, key: "cv" },
                          title: candidate.fullName,
                        })
                      }
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Eye className="h-4 w-4" /> {t("recruitment.candidates.viewCv")}
                    </button>
                  )}
                  {pieces.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        onPreview({
                          file: { candidateId: candidate.id, key },
                          title: `${candidate.fullName} — ${key}`,
                        })
                      }
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <FileText className="h-4 w-4" />{" "}
                      {key === "cover_letter" ? t("recruitment.form.presets.coverLetter") : key}
                    </button>
                  ))}
                  {candidate.hiredEmployeeId && (
                    <Link
                      to="/app/employees/$id"
                      params={{ id: candidate.hiredEmployeeId }}
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <UserCheck className="h-4 w-4" /> {t("recruitment.candidates.openEmployee")}
                    </Link>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("recruitment.candidates.matchScore")}
                  </h3>
                  {candidate.aiScoredAt && (
                    <span className="text-xs text-muted-foreground">
                      {t("recruitment.candidates.scoredAt", {
                        date: relativeDate(candidate.aiScoredAt, t),
                      })}
                    </span>
                  )}
                </div>

                {candidate.aiScore == null ? (
                  <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                    {t("recruitment.candidates.noAnalysis")}
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold ${scoreTone(candidate.aiScore)}`}
                      >
                        {candidate.aiScore}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${scoreTone(candidate.aiScore)}`}
                          style={{ width: `${Math.min(100, Math.max(0, candidate.aiScore))}%` }}
                        />
                      </div>
                    </div>

                    {candidate.aiJustification && (
                      <p className="whitespace-pre-line rounded-md bg-muted/50 p-3 text-sm">
                        {candidate.aiJustification}
                      </p>
                    )}

                    {toList(candidate.aiStrengths).length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-success">
                          <ThumbsUp className="h-3.5 w-3.5" />
                          {t("recruitment.candidates.strengths")}
                        </h4>
                        <ul className="list-disc space-y-1 pl-5 text-sm">
                          {toList(candidate.aiStrengths).map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {toList(candidate.aiWeaknesses).length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                          <ThumbsDown className="h-3.5 w-3.5" />
                          {t("recruitment.candidates.weaknesses")}
                        </h4>
                        <ul className="list-disc space-y-1 pl-5 text-sm">
                          {toList(candidate.aiWeaknesses).map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {candidate.stage !== "hired" && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("recruitment.candidates.actions")}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <StageMenu current={candidate.stage} labels={STAGE_LABELS} onSelect={onMove}>
                      <Button size="sm" variant="outline">
                        <ArrowRightLeft className="mr-1.5 h-4 w-4" />
                        {t("recruitment.candidates.moveTo")}
                      </Button>
                    </StageMenu>
                    {candidate.stage !== "rejected" && (
                      <Button size="sm" onClick={() => onMove("hired")}>
                        <UserCheck className="mr-1.5 h-4 w-4" />
                        {t("recruitment.candidates.hire")}
                      </Button>
                    )}
                  </div>
                </section>
              )}

              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <StickyNote className="h-3.5 w-3.5" /> {t("recruitment.candidates.internalNotes")}
                </h3>
                <div className="space-y-2">
                  <Textarea
                    value={noteDraft}
                    maxLength={5000}
                    aria-label={t("recruitment.candidates.addNotePlaceholder")}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder={t("recruitment.candidates.addNotePlaceholder")}
                    rows={3}
                  />
                  <Button
                    size="sm"
                    onClick={() => addNote.mutate(noteDraft.trim())}
                    disabled={addNote.isPending || !noteDraft.trim()}
                  >
                    {addNote.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <MessageSquarePlus className="mr-1.5 h-4 w-4" />
                    )}
                    {t("recruitment.candidates.addNote")}
                  </Button>
                </div>
                <div className="space-y-2 pt-1">
                  {(notes.data ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("recruitment.candidates.noNotes")}
                    </p>
                  ) : (
                    (notes.data ?? []).map((n) => (
                      <div
                        key={n.id}
                        className="rounded-md border bg-card p-3 text-sm"
                        data-testid="candidate-note"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {actorName(n.authorId) ?? t("recruitment.candidates.anonymous")} •{" "}
                              {relativeDate(n.createdAt, t)}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
                          </div>
                          {/* The author or owner / hr_admin (06 §8). */}
                          {(n.authorId === user?.id || isAdmin) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0"
                              aria-label={t("recruitment.candidates.deleteNote")}
                              onClick={() => deleteNote.mutate(n)}
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
              {events.isPending ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : (events.data ?? []).length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  {t("recruitment.candidates.noActivity")}
                </p>
              ) : (
                <ol className="relative space-y-3 border-l pl-4">
                  {(events.data ?? []).map((a) => (
                    <ActivityItem
                      key={a.id}
                      activity={a}
                      actor={actorName(a.actorId)}
                      stageLabels={STAGE_LABELS}
                    />
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

function ActivityItem({
  activity,
  actor,
  stageLabels,
}: {
  activity: CandidateEvent;
  actor: string | null;
  stageLabels: Record<Stage, string>;
}) {
  const { t, i18n } = useTranslation();
  const { icon, label } = describeActivity(activity, t, stageLabels);
  const exact = new Date(activity.createdAt).toLocaleString(
    i18n.language.startsWith("en") ? "en-GB" : "fr-FR",
  );
  return (
    <li className="relative">
      <span className="absolute -left-[26px] flex h-5 w-5 items-center justify-center rounded-full border bg-background text-muted-foreground">
        {icon}
      </span>
      <p className="text-sm">{label}</p>
      <p className="text-xs text-muted-foreground" title={exact}>
        {actor ?? t("recruitment.candidates.system")} • {relativeDate(activity.createdAt, t)}
      </p>
    </li>
  );
}

function describeActivity(
  a: CandidateEvent,
  t: (k: string, opts?: Record<string, unknown>) => string,
  stageLabels: Record<Stage, string>,
): { icon: ReactNode; label: string } {
  const p = (a.payload ?? {}) as Record<string, string | number | undefined>;
  switch (a.type) {
    case "created":
      return {
        icon: <UserPlus className="h-3 w-3" />,
        label: t("recruitment.candidates.activityDescriptions.created"),
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
        label: t("recruitment.candidates.activityDescriptions.noteAddedNoExcerpt"),
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

function DroppableColumn({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <Card
      ref={setNodeRef}
      role="region"
      aria-label={label}
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
