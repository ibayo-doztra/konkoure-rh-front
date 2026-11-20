// In-app notifications of the current organization — 06-api-reference §2.
// Only the API creates them, from business events: the front reads them and marks them read.
import { infiniteQueryOptions } from "@tanstack/react-query";
import { api, apiRequest } from "@/lib/api/client";

export const NOTIFICATIONS_PAGE_SIZE = 20;

export interface AppNotification {
  id: string;
  type: string;
  /** Already translated into the recipient's language. */
  title: string;
  body: string | null;
  /** Front path without the `/app` prefix (`/leaves/:id`, `/employees/:id`, `/timeclock`). */
  link: string | null;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationPage {
  data: AppNotification[];
  meta: { nextCursor: string | null; unreadCount: number };
}

/** These routes need `X-Organization-Id`: the bell follows the selected organization. */
const withOrganization = { withOrganization: true } as const;

export const notificationsKey = (organizationId: string) =>
  ["org", organizationId, "notifications"] as const;

export const notificationsQuery = (organizationId: string) =>
  infiniteQueryOptions({
    queryKey: notificationsKey(organizationId),
    queryFn: ({ pageParam }) =>
      apiRequest<NotificationPage>("/me/notifications", {
        method: "GET",
        query: { limit: NOTIFICATIONS_PAGE_SIZE, cursor: pageParam ?? undefined },
        ...withOrganization,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.meta.nextCursor,
    // The bell stays mounted: new notifications appear without a reload.
    refetchInterval: 60_000,
  });

export function markNotificationRead(id: string) {
  return api.post<AppNotification>(
    `/me/notifications/${encodeURIComponent(id)}/read`,
    undefined,
    withOrganization,
  );
}

export function markAllNotificationsRead() {
  return api.post<{ updated: number }>("/me/notifications/read-all", undefined, withOrganization);
}

/** Maps an API link to a route of the application. */
export function notificationRoute(link: string | null): string | null {
  if (!link) return null;
  // There is no leave detail page: the leave list opens instead.
  if (link.startsWith("/leaves")) return "/app/leaves";
  if (link === "/timeclock") return "/app/timeclock/logs";
  return link.startsWith("/app") ? link : `/app${link}`;
}
