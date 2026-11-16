import { useEffect, useState } from "react";
import { pendingQuery } from "@/lib/api/pending";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, ExternalLink, FileWarning } from "lucide-react";
import { useTranslation } from "react-i18next";

type Props = {
  /** Storage path inside the `applications` bucket, or an absolute URL. */
  fileRef: string | null;
  title?: string | null;
  onClose: () => void;
};

function guessKind(ref: string): "pdf" | "image" | "other" {
  const path = ref.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|webp|gif)$/.test(path)) return "image";
  return "other";
}

export function CvPreviewDialog({ fileRef, title, onClose }: Props) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileRef) {
      setUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setUrl(null);
    setError(null);
    void (async () => {
      if (/^https?:\/\//i.test(fileRef)) {
        if (!cancelled) setUrl(fileRef);
        return;
      }
      const { data, error: err } = await pendingQuery("GET signed-url (storage applications.createSignedUrl)");
      if (cancelled) return;
      if (err || !data?.signedUrl) {
        setError(t("recruitment.candidates.cvOpenError"));
        return;
      }
      setUrl(data.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [fileRef, t]);

  const kind = fileRef ? guessKind(fileRef) : "other";

  return (
    <Dialog open={!!fileRef} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title ?? t("recruitment.candidates.cvPreviewTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <div className="flex flex-wrap justify-end gap-2">
              {url && (
                <>
                  <Button asChild size="sm" variant="outline">
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1.5 h-4 w-4" />
                      {t("recruitment.candidates.cvOpenTab")}
                    </a>
                  </Button>
                  <Button asChild size="sm">
                    <a href={url} download>
                      <Download className="mr-1.5 h-4 w-4" />
                      {t("recruitment.candidates.cvDownload")}
                    </a>
                  </Button>
                </>
              )}
            </div>

            <div className="overflow-hidden rounded-md border bg-muted/30">
              {error ? (
                <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
                  <FileWarning className="h-6 w-6" />
                  {error}
                </div>
              ) : !url ? (
                <Skeleton className="h-[70vh] w-full" />
              ) : kind === "image" ? (
                <img
                  src={url}
                  alt={title ?? t("recruitment.candidates.cvPreviewTitle")}
                  className="max-h-[70vh] w-full object-contain"
                />
              ) : (
                <iframe
                  src={url}
                  title={title ?? t("recruitment.candidates.cvPreviewTitle")}
                  className="h-[70vh] w-full border-0 bg-background"
                />
              )}
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
