import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEmployeeLabel(
  employee: {
    first_name?: string | null;
    last_name?: string | null;
    job_title?: string | null;
    position?: string | null;
  },
  departmentName?: string | null,
): string {
  const parts = [
    [employee.first_name, employee.last_name].filter(Boolean).join(" "),
    employee.job_title || employee.position || null,
    departmentName || null,
  ].filter(Boolean) as string[];
  return parts.join(" - ");
}

/**
 * Masque un UID de badge NFC : affiche les 2 premiers caractères,
 * le reste est remplacé par des astérisques en nombre supérieur à la
 * longueur réelle de l'UID afin d'éviter toute duplication.
 */
export function maskBadgeUid(uid: string | null | undefined): string {
  if (!uid) return "—";
  const visible = uid.slice(0, 2);
  const mask = "*".repeat(Math.max(uid.length + 4, 6));
  return `${visible}${mask}`;
}

