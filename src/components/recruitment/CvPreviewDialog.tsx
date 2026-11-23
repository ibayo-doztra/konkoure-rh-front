import { useEffect, useState } from "react";
import { candidateDocumentUrl } from "@/lib/api/recruitment";
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

/** A stored piece of a candidate: `cv`, `cover_letter` or a key of the offer. */
export interface CandidateFile {
  candidateId: string;
  key: string;
}

type Props = {
  file: CandidateFile | null;
  title?: string | null;
  onClose: () => void;
};

function guessKind(ref: string): "pdf" | "image" | "other" {
  const path = ref.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|webp|gif)$/.test(path)) return "image";
  return "other";
}

export function CvPreviewDialog({ file, title, onClose }: Props) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setUrl(null);
    setError(null);
    // Signed URL issued by the API, valid 15 minutes (06 §8).
    candidateDocumentUrl(file.candidateId, file.key).then(
      (signed) => {
        if (!cancelled) setUrl(signed.url);
      },
      () => {
        if (!cancelled) setError(t("recruitment.candidates.cvOpenError"));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [file, t]);

  const kind = url ? guessKind(url) : "other";

  return (
    <Dialog open={!!file} onOpenChange={(v) => !v && onClose()}>
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
