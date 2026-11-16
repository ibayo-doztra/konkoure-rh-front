import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Copy } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  jobTitle: string;
};

export function JobQrCodeDialog({ open, onOpenChange, url, jobTitle }: Props) {
  const { t } = useTranslation();
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    if (!open || !url) return;
    QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: "M" })
      .then(setDataUrl)
      .catch(() => toast.error(t("qr.generationError")));
  }, [open, url]);

  const safeName = jobTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "offre";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("qr.title")}</DialogTitle>
          <DialogDescription className="break-all">{url}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          {dataUrl ? (
            <img src={dataUrl} alt={`QR code – ${jobTitle}`} className="h-64 w-64 rounded border bg-white p-2" />
          ) : (
            <div className="h-64 w-64 animate-pulse rounded border bg-muted" />
          )}
          <div className="flex w-full gap-2">
            <Button asChild className="flex-1" disabled={!dataUrl}>
              <a href={dataUrl} download={`qr-${safeName}.png`}>
                <Download className="mr-2 h-4 w-4" />{t("qr.download")}
              </a>
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                void navigator.clipboard.writeText(url);
                toast.success(t("qr.linkCopied"));
              }}
            >
              <Copy className="mr-2 h-4 w-4" />{t("qr.copyLink")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
