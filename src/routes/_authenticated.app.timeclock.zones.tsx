import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { pendingQuery } from "@/lib/api/pending";
import { useOrg } from "@/hooks/useOrg";
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

type ZoneRow = {
  id: string;
  name: string;
  shape: "circle" | "polygon";
  latitude: number | null;
  longitude: number | null;
  radius_meters: number | null;
  polygon: LatLng[] | null;
};

function ZonesPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const [items, setItems] = useState<ZoneRow[]>([]);
  const [mode, setMode] = useState<"circle" | "polygon">("circle");
  const [draft, setDraft] = useState<ZoneShape | null>(null);
  const [name, setName] = useState("");
  const [center, setCenter] = useState<LatLng | undefined>(undefined);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!org) return;
    const { data, error } = await pendingQuery("GET /org/timeclock/zones");
    if (error) return toast.error(error.message);
    setItems((data ?? []) as ZoneRow[]);
  };
  useEffect(() => {
    void load();
  }, [org]);

  const existing = useMemo(() => items, [items]);

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

  const save = async () => {
    if (!org) return;
    if (!name.trim()) return toast.error(t("timeclock.zones.nameRequired"));
    if (!draft) return toast.error(t("timeclock.zones.drawFirst"));
    if (draft.shape === "polygon" && draft.points.length < 3)
      return toast.error(t("timeclock.zones.polygonMinPoints"));

    setSaving(true);
    const payload =
      draft.shape === "circle"
        ? {
            organization_id: org.id,
            name: name.trim(),
            shape: "circle",
            latitude: draft.center.lat,
            longitude: draft.center.lng,
            radius_meters: Math.round(draft.radius),
            polygon: null,
          }
        : {
            organization_id: org.id,
            name: name.trim(),
            shape: "polygon",
            latitude: draft.points[0].lat,
            longitude: draft.points[0].lng,
            radius_meters: null,
            polygon: draft.points,
          };

    const { error } = await pendingQuery("POST /org/timeclock/zones");
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("timeclock.zones.created"));
    setDraft(null);
    setName("");
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await pendingQuery("DELETE /org/timeclock/zones");
    if (error) return toast.error(error.message);
    toast.success(t("timeclock.zones.deleted"));
    void load();
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
          <Card>
            <CardContent className="space-y-3 p-4">
              <h3 className="font-semibold">{t("timeclock.zones.newZone")}</h3>
              <div>
                <Label>{t("timeclock.zones.nameLabel")}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("timeclock.zones.namePlaceholder")}
                />

              </div>
              {draft?.shape === "circle" && (
                <div>
                  <Label>{t("timeclock.zones.radiusLabel", { value: Math.round(draft.radius) })}</Label>
                  <Slider
                    min={20}
                    max={2000}
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
                  {draft.points.length} {draft.points.length > 1 ? t("timeclock.zones.vertices") : t("timeclock.zones.vertex")}
                </p>
              )}
              <Button onClick={save} disabled={saving || !draft || !name.trim()} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                {t("timeclock.zones.saveZone")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 font-semibold">{t("timeclock.zones.existingZones", { count: items.length })}</h3>
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
                          ? t("timeclock.zones.circleSummary", { radius: z.radius_meters })
                          : t("timeclock.zones.polygonSummary", { count: z.polygon?.length ?? 0 })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(z.id)}
                      aria-label={t("timeclock.zones.deleteAria")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
