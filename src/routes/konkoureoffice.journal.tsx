import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { apiErrorMessage } from "@/lib/api/client";
import {
  LOG_PAGE_SIZE,
  platformKey,
  platformLogs,
  type LogFilters,
  type LogKind,
  type LogRow,
} from "@/lib/api/platform";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ResponsiveTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/konkoureoffice/journal")({
  component: AdminLogsPage,
  head: () => ({
    meta: [
      { title: "Journal & usage — Administration Konkouré" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const ALL = "all";
const LEVELS = ["debug", "info", "warn", "error", "fatal"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (value: unknown) =>
  value === null || value === undefined || value === "" ? "—" : String(value);

function levelVariant(level: unknown) {
  if (level === "error" || level === "fatal") return "destructive" as const;
  if (level === "warn") return "secondary" as const;
  return "outline" as const;
}

const COLUMNS: Record<LogKind, ResponsiveColumn<LogRow>[]> = {
  audit: [
    {
      key: "action",
      header: "Action",
      priority: "primary",
      cell: (r) => <span className="break-all font-mono text-xs">{text(r.action)}</span>,
    },
    {
      key: "actor",
      header: "Acteur",
      cell: (r) => (
        <div className="min-w-0 text-sm">
          <p className="break-words">{text(r.actorEmail)}</p>
          <p className="text-xs text-muted-foreground">{text(r.actorRole)}</p>
        </div>
      ),
    },
    {
      key: "target",
      header: "Cible",
      cell: (r) => (
        <span className="break-all text-xs">
          {text(r.targetType)}
          {r.targetId ? ` · ${String(r.targetId)}` : ""}
        </span>
      ),
    },
    {
      key: "org",
      header: "Organisation",
      cell: (r) => <span className="break-all text-xs">{text(r.organizationId)}</span>,
    },
  ],
  system: [
    {
      key: "message",
      header: "Message",
      priority: "primary",
      cell: (r) => <span className="break-words text-sm">{text(r.message)}</span>,
    },
    {
      key: "level",
      header: "Niveau",
      cell: (r) => <Badge variant={levelVariant(r.level)}>{text(r.level)}</Badge>,
    },
    { key: "channel", header: "Canal", cell: (r) => text(r.channel) },
    {
      key: "status",
      header: "HTTP",
      align: "right",
      cell: (r) => (r.statusCode ? `${String(r.statusCode)} · ${text(r.durationMs)} ms` : "—"),
    },
  ],
  usage: [
    {
      key: "kind",
      header: "Événement",
      priority: "primary",
      cell: (r) => <span className="font-mono text-xs">{text(r.kind)}</span>,
    },
    { key: "module", header: "Module", cell: (r) => text(r.module) },
    {
      key: "path",
      header: "Chemin",
      cell: (r) => <span className="break-all text-xs">{text(r.path)}</span>,
    },
    {
      key: "org",
      header: "Organisation",
      cell: (r) => <span className="break-all text-xs">{text(r.organizationId)}</span>,
    },
  ],
};

const dayStart = (date: string) => (date ? new Date(`${date}T00:00:00Z`).toISOString() : undefined);
const dayEnd = (date: string) =>
  date ? new Date(new Date(`${date}T00:00:00Z`).getTime() + 86_400_000).toISOString() : undefined;

function AdminLogsPage() {
  const [kind, setKind] = useState<LogKind>("audit");
  const [organizationId, setOrganizationId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [term, setTerm] = useState("");
  const [level, setLevel] = useState<string>(ALL);

  const filters: LogFilters = {
    organizationId: UUID.test(organizationId.trim()) ? organizationId.trim() : undefined,
    from: dayStart(from),
    to: dayEnd(to),
    ...(kind === "audit" ? { action: term.trim() || undefined } : {}),
    ...(kind === "system"
      ? { channel: term.trim() || undefined, level: level === ALL ? undefined : level }
      : {}),
    ...(kind === "usage" ? { module: term.trim() || undefined } : {}),
  };

  const logs = useInfiniteQuery({
    queryKey: [...platformKey, "logs", kind, filters],
    queryFn: ({ pageParam }) => platformLogs(kind, filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });
  const rows = logs.data?.pages.flatMap((p) => p.data) ?? [];

  const columns: ResponsiveColumn<LogRow>[] = [
    {
      key: "date",
      header: "Date",
      className: "whitespace-nowrap text-sm",
      cell: (r) => formatDateTime(r.createdAt),
    },
    ...COLUMNS[kind],
  ];

  const termLabel = kind === "audit" ? "Action exacte" : kind === "system" ? "Canal" : "Module";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal & usage"
        description="Traçabilité des actions sensibles, journaux système et usage"
      />

      <Card>
        <CardContent className="space-y-4 p-4">
          <Tabs
            value={kind}
            onValueChange={(v) => {
              setKind(v as LogKind);
              setTerm("");
              setLevel(ALL);
            }}
          >
            <TabsList>
              <TabsTrigger value="audit">Audit</TabsTrigger>
              <TabsTrigger value="system">Système</TabsTrigger>
              <TabsTrigger value="usage">Usage</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label htmlFor="log-term">{termLabel}</Label>
              <Input
                id="log-term"
                value={term}
                placeholder={kind === "audit" ? "ex. user.banned" : ""}
                onChange={(e) => setTerm(e.target.value)}
              />
            </div>
            {kind === "system" && (
              <div className="space-y-1">
                <Label htmlFor="log-level">Niveau</Label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger id="log-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Tous</SelectItem>
                    {LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="log-org">Organisation (identifiant)</Label>
              <Input
                id="log-org"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="log-from">Du</Label>
              <Input
                id="log-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="log-to">Au</Label>
              <Input id="log-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {logs.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(logs.error)}</p>
      ) : logs.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun événement" hint="Ajustez les filtres ou la période." />
      ) : (
        <Card>
          <CardContent className="p-0" data-testid="log-rows">
            <ResponsiveTable
              data={rows}
              getRowKey={(r) => r.id}
              empty="Aucun événement"
              columns={columns}
            />
          </CardContent>
        </Card>
      )}

      {logs.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => void logs.fetchNextPage()}
            disabled={logs.isFetchingNextPage}
          >
            Charger {LOG_PAGE_SIZE} de plus
          </Button>
        </div>
      )}
    </div>
  );
}
