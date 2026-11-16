import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useOrg } from "@/hooks/useOrg";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Radio, LogIn, LogOut, AlertTriangle, CheckCircle2, Loader2, Nfc } from "lucide-react";
import { scanNfcBadge, type ScanNfcBadgeResult } from "@/lib/api/legacy-functions";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/app/timeclock/scan")({
  component: ScanPage,
});

type WebNfcReader = {
  scan: (opts?: { signal?: AbortSignal }) => Promise<void>;
  addEventListener: (evt: string, cb: (e: { serialNumber?: string }) => void) => void;
};

function ScanPage() {
  const { t } = useTranslation();
  const { org } = useOrg();
  const scan = scanNfcBadge;
  const [manualUid, setManualUid] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanNfcBadgeResult | null>(null);
  const [nfcActive, setNfcActive] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const nfcSupported = typeof window !== "undefined" && "NDEFReader" in window;

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 8000 },
    );
  }, []);

  const submit = async (badge_uid: string) => {
    if (!org) return;
    const uid = badge_uid.trim();
    if (!uid) {
      toast.error(t("timeclock.scan.badgeUidMissing"));
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await scan({
        data: {
          organization_id: org.id,
          badge_uid: uid,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
        },
      });
      setResult(res);
      if (res.ok) {
        if (res.deduped) {
          toast.message(t("timeclock.scan.dedupedToast"));
        } else {
          toast.success(
            res.type === "ARRIVEE" ? t("timeclock.scan.arriveeToast") : t("timeclock.scan.departToast"),
          );
        }
        setManualUid("");
      } else {
        toast.error(res.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("timeclock.scan.unexpectedError"));
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
      <PageHeader
        title={t("timeclock.scan.title")}
        description={t("timeclock.scan.description")}
      />

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
                <Badge variant="default" className="gap-1"><Radio className="h-3 w-3 animate-pulse" /> {t("timeclock.scan.nfcActive")}</Badge>
              ) : (
                <Badge variant="outline">{t("timeclock.scan.nfcInactive")}</Badge>
              )}
            </div>
            {nfcSupported ? (
              nfcActive ? (
                <Button variant="outline" className="w-full" onClick={stopNfc}>{t("timeclock.scan.stop")}</Button>
              ) : (
                <Button className="w-full" onClick={startNfc} disabled={busy}>
                  <Nfc className="mr-2 h-4 w-4" /> {t("timeclock.scan.enableNfc")}
                </Button>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("timeclock.scan.nfcNotSupported")}
              </p>
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
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("timeclock.scan.scanButton")}
              </Button>
            </div>
          </div>

          {result && <ResultCard result={result} />}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultCard({ result }: { result: ScanNfcBadgeResult }) {
  const { t } = useTranslation();
  if (result.ok) {
    const isIn = result.type === "ARRIVEE";
    const time = new Date(result.timestamp).toLocaleTimeString("fr-FR");
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-100">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={result.employee.photo_url ?? undefined} />
            <AvatarFallback>{result.employee.first_name[0]}{result.employee.last_name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-semibold">{result.employee.first_name} {result.employee.last_name}</div>
            <div className="mt-1 flex items-center gap-2 text-sm">
              {isIn ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
              {isIn ? t("timeclock.scan.arriveeLabel") : t("timeclock.scan.departLabel")} {t("timeclock.scan.recordedAt")} {time}
              {result.deduped && (
                <Badge variant="outline" className="ml-1">{t("timeclock.scan.dedupedBadge")}</Badge>
              )}
            </div>
          </div>
          <CheckCircle2 className="h-6 w-6 text-green-600" />
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
