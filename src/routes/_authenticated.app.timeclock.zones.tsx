import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "@/lib/api/client";
import {
  createZone,
  deleteZone,
  ringToPoints,
  timeclockKey,
  zonesQuery,
  type WorkZone,
} from "@/lib/api/timeclock";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Trash2, LocateFixed, Undo2, Save, X, Shapes } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { WorkZoneMap, type ZoneShape, type LatLng } from "@/components/timeclock/WorkZoneMap";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/app/timeclock/zones")({
  component: ZonesPage,
});

function ZonesPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  // Security agents read the zones; owner and hr_admin edit them (06 §6).
  const { isAdmin } = useRole();
  const queryClient = useQueryClient();
  const organizationId = org?.id ?? "";
  const [toDelete, setToDelete] = useState<WorkZone | null>(null);
  const [mode, setMode] = useState<"circle" | "polygon">("circle");
  const [draft, setDraft] = useState<ZoneShape | null>(null);
  const [name, setName] = useState("");
  const [center, setCenter] = useState<LatLng | undefined>(undefined);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);

  const zones = useQuery({ ...zonesQuery(organizationId), enabled: !!org });
  const items = useMemo(() => zones.data ?? [], [zones.data]);
  // The map keeps its own shape for drawn zones.
  const existing = useMemo(
    () =>
      items.map((z) => ({
        id: z.id,
        name: z.name,
        shape: z.shape,
        latitude: z.latitude,
        longitude: z.longitude,
        radius_meters: z.radiusMeters,
        polygon: ringToPoints(z.polygon),
      })),
    [items],
  );
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: [...timeclockKey(organizationId), "zones"] });

  const create = useMutation({
    mutationFn: createZone,
    onSuccess: () => {
      toast.success(t("timeclock.zones.created"));
      setDraft(null);
      setName("");
      void refresh();
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteZone(id),
    onSuccess: () => {
      toast.success(t("timeclock.zones.deleted"));
      setToDelete(null);
      void refresh();
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const locate = () => {
    if (!navigator.geolocation) return toast.error(t("timeclock.zones.geolocationUnavailable"));

    const request = () =>
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCenter(p);
          setUserLocation(p);
          toast.success(t("timeclock.zones.positionAdded"));
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            toast.error(t("timeclock.zones.permissionDenied"));
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            toast.error(t("timeclock.zones.positionUnavailableClick"));
          } else if (err.code === err.TIMEOUT) {
            toast.error(t("timeclock.zones.timeout"));
          } else {
            toast.error(t("timeclock.zones.positionUnrecoverable"));
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );

    if (typeof navigator.permissions?.query === "function") {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((status) => {
          if (status.state === "denied") {
            toast.error(t("timeclock.zones.permissionDenied"));
          } else {
            request();
          }
        })
        .catch(() => request());
    } else {
      request();
    }
  };

  const undoPoint = () => {
    if (draft?.shape === "polygon" && draft.points.length > 0) {
      const pts = draft.points.slice(0, -1);
      setDraft(pts.length === 0 ? null : { shape: "polygon", points: pts });
    }
  };

  const save = () => {
    if (!org) return;
    if (name.trim().length < 2) return toast.error(t("timeclock.zones.nameRequired"));
    if (!draft) return toast.error(t("timeclock.zones.drawFirst"));
    if (draft.shape === "polygon" && draft.points.length < 3)
      return toast.error(t("timeclock.zones.polygonMinPoints"));
    create.mutate(
      draft.shape === "circle"
        ? {
            name: name.trim(),
            shape: "circle",
            center: draft.center,
            radiusMeters: Math.round(draft.radius),
          }
        : { name: name.trim(), shape: "polygon", points: draft.points },
    );
  };

  return (
    <div>
      <PageHeader
        title={t("timeclock.zones.title")}
        description={t("timeclock.zones.description")}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardContent className="p-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Tabs
                value={mode}
                onValueChange={(v) => {
                  setMode(v as "circle" | "polygon");
                  setDraft(null);
                }}
              >
                <TabsList>
                  <TabsTrigger value="circle">
                    <MapPin className="mr-2 h-4 w-4" />
                    {t("timeclock.zones.circle")}
                  </TabsTrigger>
                  <TabsTrigger value="polygon">
                    <Shapes className="mr-2 h-4 w-4" />
                    {t("timeclock.zones.polygon")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button variant="outline" size="sm" onClick={locate}>
                <LocateFixed className="mr-2 h-4 w-4" />
                {t("timeclock.zones.myPosition")}
              </Button>
              {mode === "polygon" && draft?.shape === "polygon" && draft.points.length > 0 && (
                <Button variant="outline" size="sm" onClick={undoPoint}>
                  <Undo2 className="mr-2 h-4 w-4" />
                  {t("timeclock.zones.undoLastPoint")}
                </Button>
              )}
              {draft && (
                <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                  <X className="mr-2 h-4 w-4" />
                  {t("timeclock.zones.clear")}
                </Button>
              )}
            </div>

            <WorkZoneMap
              mode={mode}
              draft={draft}
              onDraftChange={setDraft}
              existing={existing}
              center={center}
              userLocation={userLocation}
              onUserLocationChange={setUserLocation}
            />

            <p className="mt-2 text-xs text-muted-foreground">
              {mode === "circle"
                ? t("timeclock.zones.circleHint")
                : t("timeclock.zones.polygonHint")}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {isAdmin && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <h3 className="font-semibold">{t("timeclock.zones.newZone")}</h3>
                <div>
                  <Label htmlFor="zone-name">{t("timeclock.zones.nameLabel")}</Label>
                  <Input
                    id="zone-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("timeclock.zones.namePlaceholder")}
                  />
                </div>
                {draft?.shape === "circle" && (
                  <div>
                    <Label>
                      {t("timeclock.zones.radiusLabel", { value: Math.round(draft.radius) })}
                    </Label>
                    <Slider
                      min={20}
                      max={5000}
                      step={10}
                      value={[draft.radius]}
                      onValueChange={([v]) =>
                        setDraft({ shape: "circle", center: draft.center, radius: v })
                      }
                    />
                  </div>
                )}
                {draft?.shape === "polygon" && (
                  <p className="text-xs text-muted-foreground">
                    {draft.points.length}{" "}
                    {draft.points.length > 1
                      ? t("timeclock.zones.vertices")
                      : t("timeclock.zones.vertex")}
                  </p>
                )}
                <Button
                  onClick={save}
                  disabled={create.isPending || !draft || name.trim().length < 2}
                  className="w-full"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {t("timeclock.zones.saveZone")}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 font-semibold">
                {t("timeclock.zones.existingZones", { count: items.length })}
              </h3>
              <div className="space-y-2">
                {items.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("timeclock.zones.noZones")}</p>
                )}
                {items.map((z) => (
                  <div
                    key={z.id}
                    className="flex items-center justify-between rounded-md border p-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{z.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {z.shape === "circle"
                          ? t("timeclock.zones.circleSummary", { radius: z.radiusMeters })
                          : t("timeclock.zones.polygonSummary", {
                              count: ringToPoints(z.polygon)?.length ?? 0,
                            })}
                      </p>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setToDelete(z)}
                        aria-label={t("timeclock.zones.deleteAria")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t("timeclock.zones.deleteTitle")}
        subtitle={toDelete?.name}
        description={t("timeclock.zones.deleteDesc")}
        actionLabel={t("timeclock.zones.deleteAria")}
        actionVariant="destructive"
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}
