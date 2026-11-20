import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr, enGB } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import {
  markAllNotificationsRead,
  markNotificationRead,
  notificationRoute,
  notificationsKey,
  notificationsQuery,
  type AppNotification,
} from "@/lib/api/notifications";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

/** Notifications of the selected organization, created by the API from business events. */
export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const dateLocale = (i18n.resolvedLanguage || i18n.language || "fr").startsWith("en") ? enGB : fr;
  const { org } = useOrg();
  const organizationId = org?.id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const notifications = useInfiniteQuery({ ...notificationsQuery(organizationId), enabled: !!org });
  const items = notifications.data?.pages.flatMap((page) => page.data) ?? [];
  const unread = notifications.data?.pages[0]?.meta.unreadCount ?? 0;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: notificationsKey(organizationId) });
  const markAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh });
  const markOne = useMutation({ mutationFn: markNotificationRead, onSuccess: refresh });

  const onItemClick = (n: AppNotification) => {
    if (!n.readAt) markOne.mutate(n.id);
    const to = notificationRoute(n.link);
    if (to) {
      setOpen(false);
      void navigate({ to });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("notifications.title")}
          className="relative px-0 text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge
              data-testid="notifications-unread"
              className="absolute -right-1 -top-1 h-4 min-w-[16px] rounded-full px-1 text-[10px]"
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <p className="text-sm font-semibold">{t("notifications.title")}</p>
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="text-xs text-primary hover:underline"
            >
              {t("notifications.markAllRead")}
            </button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("notifications.empty")}
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => onItemClick(n)}
                    className={`block w-full px-3 py-2 text-left transition hover:bg-muted/50 ${
                      !n.readAt ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.readAt && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{n.title}</p>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.createdAt), {
                            addSuffix: true,
                            locale: dateLocale,
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {notifications.hasNextPage && (
            <div className="border-t p-2 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void notifications.fetchNextPage()}
                disabled={notifications.isFetchingNextPage}
              >
                {t("notifications.loadMore")}
              </Button>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
