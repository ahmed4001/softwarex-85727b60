import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bell, Send, Loader2, Users, History } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminBroadcastPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [target, setTarget] = useState("all");
  const [link, setLink] = useState("");

  const { data: recentBroadcasts = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["broadcast-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("action", "broadcast_notification")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const { data: userCounts } = useQuery({
    queryKey: ["user-counts-for-broadcast"],
    queryFn: async () => {
      const { count: total } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      const { data: roles } = await supabase.from("user_roles").select("role");
      const vendors = roles?.filter((r) => r.role === "vendor").length || 0;
      const admins = roles?.filter((r) => r.role === "admin" || r.role === "superadmin").length || 0;
      return { total: total || 0, vendors, admins, users: (total || 0) - vendors - admins };
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title is required");

      // Get target user IDs
      let userIds: string[] = [];
      if (target === "all") {
        const { data } = await supabase.from("profiles").select("user_id");
        userIds = (data || []).map((p) => p.user_id);
      } else if (target === "vendors") {
        const { data } = await supabase.from("user_roles").select("user_id").eq("role", "vendor");
        userIds = (data || []).map((r) => r.user_id);
      } else if (target === "admins") {
        const { data } = await supabase.from("user_roles").select("user_id").in("role", ["admin", "superadmin"]);
        userIds = (data || []).map((r) => r.user_id);
      }

      if (userIds.length === 0) throw new Error("No users found for this target group");

      // Insert notifications in batches
      const batchSize = 100;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize).map((uid) => ({
          user_id: uid,
          title: title.trim(),
          message: message.trim() || null,
          type,
          link: link.trim() || null,
        }));
        const { error } = await supabase.from("notifications").insert(batch);
        if (error) throw error;
      }

      // Log the broadcast
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("activity_logs").insert({
        action: "broadcast_notification",
        user_id: user?.id,
        entity_type: "notification",
        metadata: { title, message, type, target, recipientCount: userIds.length } as any,
      });

      return userIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["broadcast-history"] });
      toast.success(`Notification sent to ${count} users`);
      setTitle("");
      setMessage("");
      setLink("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const targetLabel = target === "all" ? `${userCounts?.total || 0} users` : target === "vendors" ? `${userCounts?.vendors || 0} vendors` : `${userCounts?.admins || 0} admins`;

  return (
    <>
      <SeoHead title="Broadcast - Admin" />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6" /> Notification Broadcaster
          </h1>
          <p className="text-muted-foreground">Send notifications to users across the platform</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Compose */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Compose Notification</CardTitle>
              <CardDescription>Send a broadcast notification to a group of users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Select value={target} onValueChange={setTarget}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users ({userCounts?.total || 0})</SelectItem>
                      <SelectItem value="vendors">Vendors ({userCounts?.vendors || 0})</SelectItem>
                      <SelectItem value="admins">Admins ({userCounts?.admins || 0})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notification Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">ℹ️ Info</SelectItem>
                      <SelectItem value="success">✅ Success</SelectItem>
                      <SelectItem value="warning">⚠️ Warning</SelectItem>
                      <SelectItem value="alert">🚨 Alert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New Feature Available" />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional detailed message..." rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Link (optional)</Label>
                <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/blog/new-feature" />
              </div>
              <Button onClick={() => broadcastMutation.mutate()} disabled={!title.trim() || broadcastMutation.isPending} className="gap-2">
                {broadcastMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send to {targetLabel}
              </Button>
            </CardContent>
          </Card>

          {/* Quick stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" /> Audience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Users</span><span className="font-medium">{userCounts?.total || 0}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Regular Users</span><span className="font-medium">{userCounts?.users || 0}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Vendors</span><span className="font-medium">{userCounts?.vendors || 0}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Admins</span><span className="font-medium">{userCounts?.admins || 0}</span></div>
            </CardContent>
          </Card>
        </div>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><History className="h-5 w-5" /> Broadcast History</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistory && <p className="text-sm text-muted-foreground">Loading...</p>}
            {!loadingHistory && recentBroadcasts.length === 0 && <p className="text-sm text-muted-foreground">No broadcasts sent yet.</p>}
            <div className="space-y-2">
              {recentBroadcasts.map((b: any) => {
                const meta = b.metadata as any;
                return (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">{meta?.title || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        To: {meta?.target || "all"} · {meta?.recipientCount || 0} recipients · {meta?.type || "info"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{b.created_at ? format(new Date(b.created_at), "MMM d, HH:mm") : ""}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
