import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Colonne d'un tableau responsive.
 * - `primary`   : valeur mise en avant (titre de la carte en vue mobile)
 * - `actions`   : bloc d'actions, aligné à droite du titre en vue mobile
 * - `secondary` : information d'appoint, masquée en vue mobile
 */
export type ResponsiveColumn<T> = {
  key: string;
  header?: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  priority?: "primary" | "normal" | "secondary" | "actions";
  align?: "left" | "right";
  className?: string;
  headClassName?: string;
  /** Masque le libellé au-dessus de la valeur en vue mobile. */
  hideLabelOnMobile?: boolean;
};

type ResponsiveTableProps<T> = {
  data: T[];
  columns: ResponsiveColumn<T>[];
  getRowKey: (row: T, index: number) => string;
  empty?: React.ReactNode;
  loading?: boolean;
  loadingRows?: number;
  /** Point de bascule tableau / cartes. */
  breakpoint?: "md" | "lg";
  className?: string;
  onRowClick?: (row: T) => void;
};

export function ResponsiveTable<T>({
  data,
  columns,
  getRowKey,
  empty = "Aucun élément.",
  loading = false,
  loadingRows = 4,
  breakpoint = "md",
  className,
  onRowClick,
}: ResponsiveTableProps<T>) {
  const tableVisible = breakpoint === "md" ? "hidden md:block" : "hidden lg:block";
  const cardsVisible = breakpoint === "md" ? "md:hidden" : "lg:hidden";

  const primary = columns.find((c) => c.priority === "primary") ?? columns[0];
  const actions = columns.filter((c) => c.priority === "actions");
  const details = columns.filter(
    (c) => c !== primary && c.priority !== "actions" && c.priority !== "secondary",
  );

  const isEmpty = !loading && data.length === 0;

  return (
    <div className={cn("w-full", className)}>
      {/* Vue tableau (écrans larges) */}
      <div className={cn(tableVisible, "w-full overflow-x-auto")}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(
                    c.align === "right" && "text-right",
                    c.headClassName,
                  )}
                >
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: loadingRows }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  {columns.map((c) => (
                    <TableCell key={c.key}>
                      <div className="h-4 w-full max-w-[10rem] animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!loading &&
              data.map((row, i) => (
                <TableRow
                  key={getRowKey(row, i)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {columns.map((c) => (
                    <TableCell
                      key={c.key}
                      className={cn(c.align === "right" && "text-right", c.className)}
                    >
                      {c.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {isEmpty && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="p-8 text-center text-muted-foreground"
                >
                  {empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Vue cartes (mobile / tablette étroite) */}
      <div className={cn(cardsVisible, "grid gap-3 p-3")}>
        {loading &&
          Array.from({ length: loadingRows }).map((_, i) => (
            <div key={`skc-${i}`} className="rounded-lg border bg-card p-3">
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          ))}
        {!loading &&
          data.map((row, i) => (
            <div
              key={getRowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "rounded-lg border bg-card p-3 text-sm shadow-card",
                onRowClick && "cursor-pointer",
              )}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div className="min-w-0 font-semibold text-foreground">
                  {primary?.cell(row)}
                </div>
                {actions.length > 0 && (
                  <div className="flex shrink-0 items-center gap-1">
                    {actions.map((c) => (
                      <React.Fragment key={c.key}>{c.cell(row)}</React.Fragment>
                    ))}
                  </div>
                )}
              </div>
              {details.length > 0 && (
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                  {details.map((c) => (
                    <div key={c.key} className="min-w-0">
                      {!c.hideLabelOnMobile && c.header && (
                        <dt className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                          {c.header}
                        </dt>
                      )}
                      <dd className="min-w-0 break-words text-foreground">{c.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))}
        {isEmpty && (
          <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>
        )}
      </div>
    </div>
  );
}
