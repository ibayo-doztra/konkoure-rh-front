import { useCallback, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export type ConfirmOptions = {
  title: string;
  subtitle?: string;
  description?: string;
  actionLabel: string;
  cancelLabel?: string;
  actionVariant?: "default" | "destructive";
};

/**
 * Remplace `window.confirm` par la boîte de confirmation standard du projet.
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (!(await confirm({ title: "…", actionLabel: "Supprimer" }))) return;
 *   // … puis rendre {confirmDialog} dans le JSX
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirmDialog = (
    <ConfirmDialog
      open={options !== null}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
      title={options?.title ?? ""}
      subtitle={options?.subtitle}
      description={options?.description}
      actionLabel={options?.actionLabel ?? ""}
      cancelLabel={options?.cancelLabel}
      actionVariant={options?.actionVariant ?? "default"}
      onConfirm={() => settle(true)}
    />
  );

  return { confirm, confirmDialog };
}
