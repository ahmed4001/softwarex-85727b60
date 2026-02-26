import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Shield, CheckCircle, XCircle, AlertTriangle, Clock, MessageCircle, Star, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

const contentTypeIcons: Record<string, any> = {
  review: Star,
  discussion: MessageCircle,
  reply: MessageCircle,
  product_submission: FileText,
};

const statusColors: Record<string, string> = {
  pending: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]",
  approved: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
  rejected: "bg-destructive/10 text-destructive",
  escalated: "bg-primary/10 text-primary",
};

export default function AdminModerationPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("pending");
  const [resolveItem, setResolveItem] = useState<any>(null);
  const [note, setNote] = useState("");
  const [action, setAction] = useState<string>("approved");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["moderation-queue", filter],
    queryFn: async () => {
      let query = supabase
        .from("moderation_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data } = await query;
      return data || [];
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("moderation_queue")
        .update({
          status: action,
          moderator_id: user!.id,
          moderator_note: note || null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", resolveItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Item ${action}`);
      setResolveItem(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["moderation-queue"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const pendingCount = items.filter((i: any) => i.status === "pending").length;

  return (
    <>
      <SeoHead title="Content Moderation — Admin" description="Review flagged content" />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" /> Content Moderation
            </h1>
            <p className="text-muted-foreground mt-1">
              {pendingCount > 0 ? `${pendingCount} items awaiting review` : "All clear — no pending items"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          {["pending", "approved", "rejected", "escalated", "all"].map((s) => (
            <Button
              key={s}
              variant={filter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(s)}
              className="capitalize"
            >
              {s}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle className="h-12 w-12 text-[hsl(var(--success))]/30 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Queue is empty</h3>
            <p className="text-sm text-muted-foreground">No {filter === "all" ? "" : filter} items to review</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item: any) => {
              const Icon = contentTypeIcons[item.content_type] || AlertTriangle;
              return (
                <Card key={item.id} className="border-border/50">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${statusColors[item.status] || "bg-muted"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs capitalize">{item.content_type}</Badge>
                        <Badge variant="outline" className="text-xs capitalize">{item.reason}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Reported {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                        {item.moderator_note && <span> · Note: {item.moderator_note}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`capitalize ${statusColors[item.status]}`}>{item.status}</Badge>
                      {item.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => { setResolveItem(item); setAction("approved"); }}>
                          Review
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>

      <Dialog open={!!resolveItem} onOpenChange={() => setResolveItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Flagged Content</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Content Type</Label>
              <p className="text-sm text-muted-foreground capitalize">{resolveItem?.content_type} — {resolveItem?.reason}</p>
            </div>
            <div>
              <Label>Action</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approve</SelectItem>
                  <SelectItem value="rejected">Reject</SelectItem>
                  <SelectItem value="escalated">Escalate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Moderator Note (optional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveItem(null)}>Cancel</Button>
            <Button onClick={() => resolveMutation.mutate()} disabled={resolveMutation.isPending}>
              {action === "approved" ? "Approve" : action === "rejected" ? "Reject" : "Escalate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
