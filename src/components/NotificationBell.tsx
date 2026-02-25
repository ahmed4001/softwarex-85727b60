import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
  });

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  const markAllRead = async () => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user!.id)
      .eq("is_read", false);
    queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="relative rounded-xl"
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4.5 w-4.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-card">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card shadow-xl z-50 animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              notifications.map((n: any) => {
                const content = (
                  <div
                    key={n.id}
                    className={cn(
                      "px-4 py-3 border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/50 transition-colors",
                      !n.is_read && "bg-primary/5"
                    )}
                    onClick={() => { if (!n.is_read) markAsRead(n.id); setOpen(false); }}
                  >
                    <div className="flex items-start gap-2">
                      {!n.is_read && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                        {n.message && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} to={n.link}>{content}</Link>
                ) : (
                  <div key={n.id}>{content}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
