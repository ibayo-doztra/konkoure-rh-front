import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function ListPager({
  page,
  lastPage,
  onChange,
}: {
  page: number;
  lastPage: number;
  onChange: (page: number) => void;
}) {
  const { t } = useTranslation();
  if (lastPage <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 pt-2">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        {t("common.previous")}
      </Button>
      <span className="text-sm text-muted-foreground">
        {page} / {lastPage}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= lastPage}
        onClick={() => onChange(page + 1)}
      >
        {t("common.next")}
      </Button>
    </div>
  );
}

/** Keeps a list on an existing page after its last row was removed. */
export function useClampedPage(lastPage: number, page: number, setPage: (page: number) => void) {
  useEffect(() => {
    if (page > 1 && page > lastPage) setPage(Math.max(lastPage, 1));
  }, [lastPage, page, setPage]);
}
