import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Radio, LogIn, LogOut, AlertTriangle, CheckCircle2, Loader2, Nfc } from "lucide-react";
import { apiErrorMessage, newIdempotencyKey } from "@/lib/api/client";
import { scanBadge, type Punch } from "@/lib/api/timeclock";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/app/timeclock/scan")({
  component: ScanPage,
});

type WebNfcReader = {
  scan: (opts?: { signal?: AbortSignal }) => Promise<void>;
  addEventListener: (evt: string, cb: (e: { serialNumber?: string }) => void) => void;
};

type ScanResult = { ok: true; punch: Punch } | { ok: false; message: string };

function ScanPage() {
  const { t } = useTranslation();
  const [manualUid, setManualUid] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [nfcActive, setNfcActive] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const nfcSupported = typeof window !== "undefined" && "NDEFReader" in window;

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setCoords({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 8000 },
    );
  }, []);

  const submit = async (rawUid: string) => {
    const uid = rawUid.trim();
    if (!uid) {
      toast.error(t("timeclock.scan.badgeUidMissing"));
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      // The type (in or out) is deduced by the API from the last punch.
      const punch = await scanBadge({
        badgeUid: uid,
        latitude: coords?.lat,
        longitude: coords?.lng,
        accuracyMeters: coords ? Math.min(Math.round(coords.accuracy), 10_000) : undefined,
        clientPunchId: newIdempotencyKey(),
      });
      setResult({ ok: true, punch });
      toast.success(
        punch.type === "in" ? t("timeclock.scan.arriveeToast") : t("timeclock.scan.departToast"),
      );
      setManualUid("");
    } catch (error) {
      const message = apiErrorMessage(error) || t("timeclock.scan.unexpectedError");
      setResult({ ok: false, message });
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const startNfc = async () => {
    if (!nfcSupported) {
      toast.error(t("timeclock.scan.nfcUnavailable"));
      return;
    }
    try {
      const reader = new (window as unknown as { NDEFReader: new () => WebNfcReader }).NDEFReader();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      await reader.scan({ signal: ctrl.signal });
      setNfcActive(true);
      reader.addEventListener("reading", (e) => {
        const uid = e.serialNumber ?? "";
        if (uid) void submit(uid);
      });
      toast.success(t("timeclock.scan.nfcActiveToast"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("timeclock.scan.nfcEnableError"));
    }
  };

  const stopNfc = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setNfcActive(false);
  };

  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("timeclock.scan.title")} description={t("timeclock.scan.description")} />

      <Card>
        <CardContent className="space-y-5 p-6">
          <p className="text-xs text-muted-foreground">
            {coords
              ? t("timeclock.scan.positionDetected")
              : t("timeclock.scan.positionUnavailable")}
          </p>

          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Nfc className="h-4 w-4" /> {t("timeclock.scan.nfcReader")}
              </div>
              {nfcActive ? (
                <Badge variant="default" className="gap-1">
                  <Radio className="h-3 w-3 animate-pulse" /> {t("timeclock.scan.nfcActive")}
                </Badge>
              ) : (
                <Badge variant="outline">{t("timeclock.scan.nfcInactive")}</Badge>
              )}
            </div>
            {nfcSupported ? (
              nfcActive ? (
                <Button variant="outline" className="w-full" onClick={stopNfc}>
                  {t("timeclock.scan.stop")}
                </Button>
              ) : (
                <Button className="w-full" onClick={startNfc} disabled={busy}>
                  <Nfc className="mr-2 h-4 w-4" /> {t("timeclock.scan.enableNfc")}
                </Button>
              )
            ) : (
              <p className="text-sm text-muted-foreground">{t("timeclock.scan.nfcNotSupported")}</p>
            )}
          </div>

          <div>
            <Label htmlFor="manual">{t("timeclock.scan.manualUidLabel")}</Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="manual"
                placeholder={t("timeclock.scan.manualUidPlaceholder")}
                value={manualUid}
                onChange={(e) => setManualUid(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !busy) void submit(manualUid);
                }}
                disabled={busy}
                autoComplete="off"
              />
              <Button onClick={() => void submit(manualUid)} disabled={busy || !manualUid.trim()}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("timeclock.scan.scanButton")
                )}
              </Button>
            </div>
          </div>

          {result && <ResultCard result={result} />}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultCard({ result }: { result: ScanResult }) {
  const { t, i18n } = useTranslation();
  if (result.ok) {
    const { punch } = result;
    const isIn = punch.type === "in";
    const time = new Date(punch.punchedAt).toLocaleTimeString(
      i18n.language?.startsWith("en") ? "en-US" : "fr-FR",
    );
    const [first = "", last = ""] = punch.employee.fullName.split(" ");
    return (
      <div className="rounded-lg border border-success/40 bg-success/10 p-4 text-foreground">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={punch.employee.photoUrl ?? undefined} />
            <AvatarFallback>
              {first[0]}
              {last[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-semibold">{punch.employee.fullName}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              {isIn ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
              {isIn ? t("timeclock.scan.arriveeLabel") : t("timeclock.scan.departLabel")}{" "}
              {t("timeclock.scan.recordedAt")} {time}
              {punch.workZone && (
                <Badge variant="outline" className="ml-1">
                  {punch.workZone.name}
                </Badge>
              )}
              {punch.anomaly && (
                <Badge variant="destructive" className="ml-1">
                  {t(`timeclock.anomaly.${punch.anomaly}`, { defaultValue: punch.anomaly })}
                </Badge>
              )}
            </div>
          </div>
          <CheckCircle2 className="h-6 w-6 text-success" />
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
        <div>
          <div className="font-semibold text-destructive">{t("timeclock.scan.refused")}</div>
          <div className="text-sm text-muted-foreground">{result.message}</div>
        </div>
      </div>
    </div>
  );
}
