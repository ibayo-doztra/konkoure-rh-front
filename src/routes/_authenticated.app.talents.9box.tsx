import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api/client";
import { cyclesQuery } from "@/lib/api/performance";
import { organizationQuery, updateOrganizationSettings } from "@/lib/api/organization";
import {
  DEFAULT_NINE_BOX_THRESHOLDS,
  nineBoxQuery,
  talentsKey,
  type NineBox,
  type NineBoxLevel,
  type NineBoxPlacement,
  type NineBoxThresholds,
} from "@/lib/api/talents";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/talents/9box")({
  component: NineBoxPage,
});

/** Label of a cell: performance first, then potential. */
const LABELS: Record<NineBoxLevel, Record<NineBoxLevel, string>> = {
  high: { low: "riskTalent", medium: "performer", high: "star" },
  medium: { low: "inconsistent", medium: "solidContributor", high: "highPotential" },
  low: { low: "underperformer", medium: "toDevelop", high: "roughDiamond" },
};

/** Rows from the highest potential; columns from the lowest performance. */
const ROWS: NineBoxLevel[] = ["high", "medium", "low"];
const COLUMNS: NineBoxLevel[] = ["low", "medium", "high"];

const RANK: Record<NineBoxLevel, number> = { low: 0, medium: 1, high: 2 };

/** Semantic shade of a cell, from the weakest to the strongest profile. */
function cellTone(performance: NineBoxLevel, potential: NineBoxLevel) {
  const score = RANK[performance] + RANK[potential];
  if (score >= 4) return "border-success/40 bg-success/10";
  if (score === 3) return "border-success/25 bg-success/5";
  if (score === 0) return "border-destructive/30 bg-destructive/5";
  if (score === 1) return "border-warning/30 bg-warning/5";
  return "bg-card";
}

/**
 * 9-box of a performance cycle: every evaluation for owner and hr_admin, the
 * team for a manager. Scores are set by HR on each evaluation.
 */
function NineBoxPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const { isAdmin } = useRole();
  const organizationId = org?.id ?? "";
  const cycles = useQuery({ ...cyclesQuery(organizationId), enabled: !!org });
  const sortedCycles = [...(cycles.data ?? [])].sort((a, b) =>
    b.periodStart.localeCompare(a.periodStart),
  );
  const [picked, setPicked] = useState<string | null>(null);
  const cycleId = picked ?? sortedCycles[0]?.id ?? null;
  const box = useQuery({ ...nineBoxQuery(organizationId, cycleId ?? ""), enabled: !!cycleId });
  const [thresholdsOpen, setThresholdsOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("talents.nineBox.title")}
        description={t("talents.nineBox.description")}
        actions={
          isAdmin ? (
            <Button variant="outline" onClick={() => setThresholdsOpen(true)}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              {t("talents.nineBox.thresholds.open")}
            </Button>
          ) : undefined
        }
      />

      {cycles.isPending ? (
        <Skeleton className="h-10 w-64" />
      ) : sortedCycles.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {t("talents.nineBox.noCycle")}
          </CardContent>
        </Card>
      ) : (
        <Select value={cycleId ?? ""} onValueChange={setPicked}>
          <SelectTrigger className="w-full sm:w-[320px]" aria-label={t("talents.nineBox.cycle")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortedCycles.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {cycleId &&
        (box.isPending ? (
          <Skeleton className="h-[420px] w-full" />
        ) : box.isError ? (
          <p className="text-sm text-destructive">{apiErrorMessage(box.error)}</p>
        ) : (
          <NineBoxGrid box={box.data} />
        ))}

      {thresholdsOpen && (
        <ThresholdsDialog
          current={box.data?.thresholds ?? DEFAULT_NINE_BOX_THRESHOLDS}
          onClose={() => setThresholdsOpen(false)}
        />
      )}
    </div>
  );
}

function NineBoxGrid({ box }: { box: NineBox }) {
  const { t } = useTranslation();
  const at = (performance: NineBoxLevel, potential: NineBoxLevel) =>
    box.cells.find((c) => c.performance === performance && c.potential === potential)?.employees ??
    [];
  const { lowMax, mediumMax } = box.thresholds;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="hidden w-6 items-center justify-center md:flex">
          <span className="-rotate-90 whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("talents.nineBox.potentialAxis")}
          </span>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
          {ROWS.map((potential) =>
            COLUMNS.map((performance) => {
              const employees = at(performance, potential);
              const label = t(`talents.nineBox.labels.${LABELS[performance][potential]}`);
              return (
                <section
                  key={`${performance}-${potential}`}
                  aria-label={label}
                  data-testid="nine-box-cell"
                  className={cn(
                    "flex min-h-[140px] flex-col rounded-lg border p-3",
                    cellTone(performance, potential),
                  )}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{label}</h3>
                      <p className="text-xs text-muted-foreground">
                        {t("talents.nineBox.cellAxes", {
                          performance: t(`talents.nineBox.levels.${performance}`),
                          potential: t(`talents.nineBox.levels.${potential}`),
                        })}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs font-medium tabular-nums">
                      {employees.length}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {employees.map((e) => (
                      <PlacementItem key={e.reviewId} placement={e} />
                    ))}
                  </ul>
                </section>
              );
            }),
          )}
        </div>
      </div>
      <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground md:pl-8">
        {t("talents.nineBox.performanceAxis")}
      </p>

      <p className="text-xs text-muted-foreground">
        {t("talents.nineBox.legend", {
          lowMax,
          mediumMin: lowMax + 1,
          mediumMax,
          highMin: mediumMax + 1,
        })}
      </p>

      <Card>
        <CardContent className="space-y-2 p-4">
          <h3 className="text-sm font-semibold">
            {t("talents.nineBox.unplaced", { count: box.unplaced.length })}
          </h3>
          <p className="text-xs text-muted-foreground">{t("talents.nineBox.unplacedHint")}</p>
          {box.unplaced.length > 0 && (
            <ul
              className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3"
              data-testid="nine-box-unplaced"
            >
              {box.unplaced.map((e) => (
                <PlacementItem key={e.reviewId} placement={e} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">{t("talents.nineBox.footer")}</p>
    </div>
  );
}

function PlacementItem({ placement }: { placement: NineBoxPlacement }) {
  const { t } = useTranslation();
  const score = (v: number | null) => (v == null ? "—" : String(v));
  return (
    <li>
      <Link
        to="/app/performance/reviews/$id"
        params={{ id: placement.reviewId }}
        className="flex items-center justify-between gap-2 rounded-md border bg-card px-2 py-1.5 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 truncate font-medium">{placement.name ?? "—"}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {t("talents.nineBox.scores", {
            performance: score(placement.performanceScore),
            potential: score(placement.potentialScore),
          })}
        </span>
      </Link>
    </li>
  );
}

function ThresholdsDialog({
  current,
  onClose,
}: {
  current: NineBoxThresholds;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const queryClient = useQueryClient();
  const [lowMax, setLowMax] = useState(current.lowMax);
  const [mediumMax, setMediumMax] = useState(current.mediumMax);
  const invalid = lowMax >= mediumMax;

  const save = useMutation({
    mutationFn: async () => {
      // The PUT replaces the whole block: start from the saved settings.
      const detail = await queryClient.fetchQuery(organizationQuery(organizationId));
      const settings = (detail.settings ?? {}) as Record<string, unknown>;
      const talents = (settings.talents ?? {}) as Record<string, unknown>;
      return updateOrganizationSettings({
        ...settings,
        talents: { ...talents, nineBox: { lowMax, mediumMax } },
      });
    },
    onSuccess: (detail) => {
      queryClient.setQueryData(organizationQuery(organizationId).queryKey, detail);
      toast.success(t("talents.nineBox.thresholds.saved"));
      onClose();
      return queryClient.invalidateQueries({ queryKey: [...talentsKey(organizationId), "9box"] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const numberSelect = (
    id: string,
    label: string,
    value: number,
    options: number[],
    onChange: (v: number) => void,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={String(o)}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("talents.nineBox.thresholds.title")}</DialogTitle>
          <DialogDescription>{t("talents.nineBox.thresholds.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4 sm:grid-cols-2">
            {numberSelect(
              "nine-box-low-max",
              t("talents.nineBox.thresholds.lowMax"),
              lowMax,
              [1, 2, 3],
              setLowMax,
            )}
            {numberSelect(
              "nine-box-medium-max",
              t("talents.nineBox.thresholds.mediumMax"),
              mediumMax,
              [2, 3, 4],
              setMediumMax,
            )}
          </div>
          {invalid ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {t("talents.nineBox.thresholds.invalid")}
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("talents.nineBox.legend", {
                lowMax,
                mediumMin: lowMax + 1,
                mediumMax,
                highMin: mediumMax + 1,
              })}
            </p>
          )}
          <DialogActions>
            <Button variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => save.mutate()} disabled={invalid || save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
