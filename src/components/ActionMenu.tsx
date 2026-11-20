import { type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ActionMenuItem =
  | {
      type?: "item";
      label: string;
      icon?: ReactNode;
      onSelect?: () => void;
      href?: string;
      variant?: "default" | "destructive";
      disabled?: boolean;
      hidden?: boolean;
    }
  | { type: "separator"; hidden?: boolean };

type Props = {
  items: ActionMenuItem[];
  align?: "start" | "end" | "center";
  label?: string;
  triggerClassName?: string;
};

export function ActionMenu({ items, align = "end", label = "Actions", triggerClassName }: Props) {
  const visible = items.filter((i) => !("hidden" in i && i.hidden));
  if (visible.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={label}
          className={cn("h-9 w-9 p-0 text-foreground", triggerClassName)}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[10rem]">
        {visible.map((it, idx) => {
          if ("type" in it && it.type === "separator") {
            return <DropdownMenuSeparator key={`sep-${idx}`} />;
          }
          const item = it as Extract<ActionMenuItem, { label: string }>;
          const cls = cn(
            "gap-2",
            item.variant === "destructive" && "text-destructive focus:text-destructive",
          );
          if (item.href) {
            return (
              <DropdownMenuItem key={item.label} asChild disabled={item.disabled} className={cls}>
                <a href={item.href} target="_blank" rel="noopener noreferrer">
                  {item.icon}
                  <span>{item.label}</span>
                </a>
              </DropdownMenuItem>
            );
          }
          return (
            <DropdownMenuItem
              key={item.label}
              disabled={item.disabled}
              onSelect={() => {
                // Let the menu close first: a dialog opened while it is still
                // open would leave it on screen once the dialog is dismissed.
                setTimeout(() => item.onSelect?.(), 0);
              }}
              className={cls}
            >
              {item.icon}
              <span>{item.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
