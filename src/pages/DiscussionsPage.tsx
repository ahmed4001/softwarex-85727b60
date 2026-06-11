import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MessageCircle, Plus, ArrowUp, Pin, Lock, Search } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PaginationControls } from "@/components/PaginationControls";

const PAGE_SIZE = 20;

export default function DiscussionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<"recent" | "popular">("recent");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", body: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["discussions", page, sort, search],
    queryFn: async () => {
      let query = supabase
        .from("discussions")
        .select("*", { count: "exact" });

      if (search.trim()) {
        query = query.ilike("title", `%${search}%`);
      }

      if (sort === "popular") {
        query = query.order("upvote_count", { ascending: false });
      } else {
        query = query.order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
      }

      const { data: discussions, count } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (discussions && discussions.length > 0) {
        const userIds = [...new Set(discussions.map((d: any) => d.user_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, name, avatar_url").in("user_id", userIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        return {
          discussions: discussions.map((d: any) => ({ ...d, profile: profileMap.get(d.user_id) })),
          count: count || 0,
        };
      }
      return { discussions: [], count: 0 };
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("discussions").insert({
        title: form.title,
        body: form.body,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Discussion created!");
      setShowForm(false);
      setForm({ title: "", body: "" });
      queryClient.invalidateQueries({ queryKey: ["discussions"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const totalPages = Math.max(1, Math.ceil((data?.count || 0) / PAGE_SIZE));

  return (
    <>
      <SeoHead title="Community Discussions" description="Join the conversation about software tools and workflows" />
      <div className="container py-8 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">Community Discussions</h1>
              <p className="text-muted-foreground mt-1">Ask questions, share tips, and discuss software</p>
            </div>
            {user && (
              <Button className="gap-1.5 rounded-xl" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" /> New Discussion
              </Button>
            )}
          </div>
        </motion.div>

        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search discussions..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-10 rounded-xl" />
          </div>
          <Select value={sort} onValueChange={(v) => { setSort(v as any); setPage(0); }}>
            <SelectTrigger className="w-36 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />)}</div>
        ) : data?.discussions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No discussions yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data?.discussions.map((d: any) => (
              <Link key={d.id} to={`/discussions/${d.slug || d.id}`}>
                <Card className="hover:border-primary/30 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center gap-1 text-muted-foreground pt-1">
                        <ArrowUp className="h-4 w-4" />
                        <span className="text-sm font-bold">{d.upvote_count}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {d.is_pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                          {d.is_locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                          <h3 className="text-base font-semibold text-foreground">{d.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{d.body}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{d.profile?.name || "Anonymous"}</span>
                          <span>·</span>
                          <span>{formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{d.reply_count} replies</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} className="mt-8" />
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Discussion</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What's on your mind?" className="rounded-xl" />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea value={form.body} onChange={(e) => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Share details, ask a question..." className="rounded-xl min-h-[120px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.title.trim() || !form.body.trim() || createMutation.isPending}>Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
