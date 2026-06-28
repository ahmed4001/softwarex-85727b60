import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Eye, Clock, FileText, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";

const STATUS_OPTIONS = ["pending", "approved", "rejected"] as const;

export default function AdminSubmissionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["admin-submissions", statusFilter, search],
    queryFn: async () => {
      let query = supabase
        .from("vendor_submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }
      const { data } = await query.limit(50);
      if (!data) return [];
      if (!search.trim()) return data;
      return data.filter((s: any) => {
        const pd = s.product_data as any;
        return pd?.name?.toLowerCase().includes(search.toLowerCase());
      });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { error } = await supabase
        .from("vendor_submissions")
        .update({
          status: status as any,
          reviewed_by: user!.id,
          review_notes: notes || null,
        })
        .eq("id", id);
      if (error) throw error;

      // If approved, create the product
      if (status === "approved") {
        const sub = submissions.find((s: any) => s.id === id);
        if (sub) {
          const pd = sub.product_data as any;
          const slug = (pd.name || "product")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
          const { error: prodErr } = await supabase.from("products").insert({
            name: pd.name,
            slug: slug + "-" + Date.now().toString(36),
            tagline: pd.tagline || null,
            description: pd.description || null,
            website_url: pd.website_url || null,
            logo_url: pd.logo_url || null,
            pricing_model: pd.pricing_model || "free",
            category_id: pd.category_id || null,
            is_active: true,
          });
          if (prodErr) throw prodErr;
        }
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
      toast.success(vars.status === "approved" ? "Submission approved & product created" : "Submission rejected");
      setExpandedId(null);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update"),
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "approved": return "default";
      case "rejected": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <>
      <SeoHead title="Submissions - Admin" robots="noindex, nofollow" />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Product Submissions</h1>
          <p className="text-muted-foreground">Review and approve vendor product submissions</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by product name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">⏳ Pending</SelectItem>
              <SelectItem value="approved">✅ Approved</SelectItem>
              <SelectItem value="rejected">❌ Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted/50 animate-pulse" />)}</div>
        ) : submissions.length === 0 ? (
          <div className="product-card p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No submissions found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub: any) => {
              const pd = sub.product_data as any;
              const isExpanded = expandedId === sub.id;

              return (
                <div key={sub.id} className="product-card p-0 overflow-hidden">
                  <div
                    className="flex items-center gap-4 p-5 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                  >
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      {pd?.logo_url ? (
                        <img decoding="async" loading="lazy" src={pd.logo_url} alt="" className="h-full w-full object-cover rounded-lg" />
                      ) : (
                        <span className="text-sm font-bold text-primary">{(pd?.name || "?").charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{pd?.name || "Unnamed Product"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(sub.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant={statusColor(sub.status)} className="capitalize text-xs">{sub.status}</Badge>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border p-5 bg-muted/10 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Product Name</p>
                          <p className="text-foreground">{pd?.name || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Website</p>
                          <p className="text-foreground">{pd?.website_url || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Pricing Model</p>
                          <p className="text-foreground capitalize">{pd?.pricing_model || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Category</p>
                          <p className="text-foreground">{pd?.category || "—"}</p>
                        </div>
                      </div>

                      {pd?.tagline && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Tagline</p>
                          <p className="text-sm text-foreground">{pd.tagline}</p>
                        </div>
                      )}

                      {pd?.description && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{pd.description}</p>
                        </div>
                      )}

                      {sub.review_notes && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Admin Notes</p>
                          <p className="text-sm text-foreground">{sub.review_notes}</p>
                        </div>
                      )}

                      {sub.status === "pending" && (
                        <div className="space-y-3 pt-2 border-t border-border">
                          <Textarea
                            value={reviewNotes[sub.id] || ""}
                            onChange={(e) => setReviewNotes((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                            placeholder="Optional review notes..."
                            rows={2}
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="gap-1.5"
                              disabled={reviewMutation.isPending}
                              onClick={() => reviewMutation.mutate({ id: sub.id, status: "approved", notes: reviewNotes[sub.id] })}
                            >
                              <Check className="h-3.5 w-3.5" /> Approve & Create Product
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-1.5"
                              disabled={reviewMutation.isPending}
                              onClick={() => reviewMutation.mutate({ id: sub.id, status: "rejected", notes: reviewNotes[sub.id] })}
                            >
                              <X className="h-3.5 w-3.5" /> Reject
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
