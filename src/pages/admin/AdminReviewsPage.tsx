import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StarRating } from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";
import { Search, Check, X, Flag, Eye, Trash2, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminReviewsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewReview, setPreviewReview] = useState<any | null>(null);
  const [moderationNote, setModerationNote] = useState("");
  const queryClient = useQueryClient();

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["admin-reviews", search, statusFilter],
    queryFn: async () => {
      let query = supabase.from("reviews").select("*, products(name, slug), profiles(name, user_id)").order("created_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
      if (search) query = query.ilike("title", `%${search}%`);
      const { data } = await query.limit(50);
      const list: any[] = data || [];
      const userIds = Array.from(new Set(list.map((r: any) => r.profiles?.user_id).filter(Boolean)));
      if (userIds.length) {
        const { data: emails } = await (supabase as any).rpc("admin_get_user_emails", { _user_ids: userIds });
        const map = new Map<string, string>((emails || []).map((e: any) => [e.user_id, e.email]));
        list.forEach((r: any) => { if (r.profiles) r.profiles.email = map.get(r.profiles.user_id) ?? null; });
      }
      return list;
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleAll = () => {
    if (!reviews) return;
    setSelectedIds(selectedIds.size === reviews.length ? new Set() : new Set(reviews.map((r: any) => r.id)));
  };

  const moderateMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const update: any = { status: status as any, moderated_at: new Date().toISOString() };
      if (note) update.moderation_note = note;
      const { error } = await supabase.from("reviews").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-reviews"] }); toast.success("Review updated"); },
    onError: () => toast.error("Failed to update review"),
  });

  const bulkModerateMutation = useMutation({
    mutationFn: async (status: string) => {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("reviews").update({ status: status as any, moderated_at: new Date().toISOString() }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      setSelectedIds(new Set());
      toast.success("Bulk update applied");
    },
    onError: () => toast.error("Bulk update failed"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("reviews").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      setSelectedIds(new Set());
      toast.success("Reviews deleted");
    },
    onError: () => toast.error("Bulk delete failed"),
  });

  const handleModerateWithNote = (status: string) => {
    if (!previewReview) return;
    moderateMutation.mutate({ id: previewReview.id, status, note: moderationNote || undefined });
    setPreviewReview(null);
    setModerationNote("");
  };

  const pendingCount = reviews?.filter((r: any) => r.status === "pending").length || 0;
  const flaggedCount = reviews?.filter((r: any) => r.status === "flagged").length || 0;

  return (
    <>
      <SeoHead title="Reviews - Admin" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reviews</h1>
            <p className="text-muted-foreground">
              Manage and moderate user reviews
              {pendingCount > 0 && <Badge variant="secondary" className="ml-2">{pendingCount} pending</Badge>}
              {flaggedCount > 0 && <Badge variant="destructive" className="ml-2">{flaggedCount} flagged</Badge>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search reviews..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="spam">Spam</SelectItem>
              <SelectItem value="flagged">Flagged</SelectItem>
            </SelectContent>
          </Select>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">{selectedIds.size} selected</span>
              <Button variant="outline" size="sm" onClick={() => bulkModerateMutation.mutate("approved")}>Approve All</Button>
              <Button variant="outline" size="sm" onClick={() => bulkModerateMutation.mutate("rejected")}>Reject All</Button>
              <Button variant="outline" size="sm" onClick={() => bulkModerateMutation.mutate("spam")}>Mark Spam</Button>
              <Button variant="destructive" size="sm" onClick={() => bulkDeleteMutation.mutate()}>Delete</Button>
            </div>
          )}
        </div>

        <div className="product-card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 w-10"><Checkbox checked={reviews?.length ? selectedIds.size === reviews.length : false} onCheckedChange={toggleAll} /></th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Product</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Reviewer</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Rating</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Title</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Date</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews?.map((r: any) => (
                <tr key={r.id} className="admin-table-row">
                  <td className="px-4 py-3"><Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} /></td>
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{r.products?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-foreground">{r.profiles?.name || "Anonymous"}</p>
                    <p className="text-xs text-muted-foreground">{r.profiles?.email}</p>
                  </td>
                  <td className="px-4 py-3"><StarRating rating={r.overall_rating} size="sm" /></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">{r.title || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.created_at ? format(new Date(r.created_at), "MMM d, yyyy") : ""}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setPreviewReview(r); setModerationNote(r.moderation_note || ""); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {r.status === "pending" && (
                        <>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => moderateMutation.mutate({ id: r.id, status: "approved" })}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => moderateMutation.mutate({ id: r.id, status: "rejected" })}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moderateMutation.mutate({ id: r.id, status: "flagged" })}>
                        <Flag className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>}
              {!isLoading && reviews?.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No reviews found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Preview Dialog */}
      <Dialog open={!!previewReview} onOpenChange={(o) => !o && setPreviewReview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
          </DialogHeader>
          {previewReview && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{previewReview.products?.name}</p>
                  <p className="text-xs text-muted-foreground">by {previewReview.profiles?.name || "Anonymous"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StarRating rating={previewReview.overall_rating} size="sm" />
                  <StatusBadge status={previewReview.status} />
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground mb-1">{previewReview.title || "Untitled"}</p>
                <p className="text-sm text-muted-foreground">{previewReview.body || "No body text."}</p>
              </div>

              {(previewReview.pros || previewReview.cons) && (
                <div className="grid grid-cols-2 gap-3">
                  {previewReview.pros && (
                    <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                      <p className="text-xs font-semibold text-green-700 mb-1">Pros</p>
                      <p className="text-xs text-muted-foreground">{previewReview.pros}</p>
                    </div>
                  )}
                  {previewReview.cons && (
                    <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                      <p className="text-xs font-semibold text-destructive mb-1">Cons</p>
                      <p className="text-xs text-muted-foreground">{previewReview.cons}</p>
                    </div>
                  )}
                </div>
              )}

              {(previewReview.ease_of_use || previewReview.features_rating || previewReview.customer_support || previewReview.value_for_money) && (
                <div className="grid grid-cols-2 gap-2">
                  {previewReview.ease_of_use && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Ease of Use</span><StarRating rating={previewReview.ease_of_use} size="sm" /></div>}
                  {previewReview.features_rating && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Features</span><StarRating rating={previewReview.features_rating} size="sm" /></div>}
                  {previewReview.customer_support && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Support</span><StarRating rating={previewReview.customer_support} size="sm" /></div>}
                  {previewReview.value_for_money && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Value</span><StarRating rating={previewReview.value_for_money} size="sm" /></div>}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Moderation Note</p>
                <Textarea value={moderationNote} onChange={(e) => setModerationNote(e.target.value)} placeholder="Add a moderation note (optional)..." rows={2} />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => handleModerateWithNote("rejected")}>Reject</Button>
                <Button variant="outline" size="sm" onClick={() => handleModerateWithNote("flagged")}>Flag</Button>
                <Button variant="outline" size="sm" onClick={() => handleModerateWithNote("spam")}>Spam</Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleModerateWithNote("approved")}>Approve</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
