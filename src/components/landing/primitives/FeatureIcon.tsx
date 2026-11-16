import {
  CalendarDays,
  Grid3x3,
  HeartHandshake,
  KanbanSquare,
  MapPin,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { IconKey } from "@/lib/landing/copy";
import { cn } from "@/lib/utils";

const ICONS: Record<IconKey, LucideIcon> = {
  sparkles: Sparkles,
  handshake: HeartHandshake,
  shield: ShieldCheck,
  trending: TrendingUp,
  users: Users,
  kanban: KanbanSquare,
  target: Target,
  pin: MapPin,
  calendar: CalendarDays,
  grid: Grid3x3,
};

/** Pastille d'icône partagée par les cartes bénéfices et modules. */
export function FeatureIcon({ name, className }: { name: IconKey; className?: string }) {
  const Icon = ICONS[name];
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-[42px] w-[42px] shrink-0 place-items-center rounded-md bg-primary-soft text-primary-strong",
        className,
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
    </span>
  );
}
