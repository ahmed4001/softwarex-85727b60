import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { FileText, Clock, CheckCircle2, Send, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

export function ContentPipelineWidget() {
  const { data: pipeline } = useQuery({
    queryKey: ["admin-content-pipeline"],
    queryFn: async () => {
      const [drafts, scheduled, published] = await Promise.all([
        supabase
          .from("blog_posts")
          .select("id, title, slug, updated_at")
          .eq("status", "draft")
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase
          .from("blog_posts")
          .select("id, title, slug, scheduled_at")
          .eq("status", "scheduled")
          .order("scheduled_at", { ascending: true })
          .limit(5),
        supabase
          .from("blog_posts")
          .select("id, title, slug, published_at, view_count")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(3),
      ]);
      return {
        drafts: drafts.data || [],
        scheduled: scheduled.data || [],
        recent: published.data || [],
      };
    },
  });

  if (!pipeline) return null;

  const totalInPipeline = pipeline.drafts.length + pipeline.scheduled.length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Content Pipeline</h3>
            </div>
            <Link to="/admin/blog">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                View All <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          {totalInPipeline === 0 && pipeline.recent.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">No content in pipeline</p>
              <Link to="/admin/blog/new">
                <Button size="sm" variant="outline" className="mt-2 gap-1.5 rounded-xl">
                  <FileText className="h-3 w-3" /> Create Post
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {pipeline.drafts.map((d: any) => (
                <Link key={d.id} to={`/admin/blog/${d.id}/edit`} className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <Clock className="h-3.5 w-3.5 text-[hsl(var(--warning))] flex-shrink-0" />
                  <span className="text-sm text-foreground truncate flex-1">{d.title}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">Draft</span>
                </Link>
              ))}
              {pipeline.scheduled.map((s: any) => (
                <Link key={s.id} to={`/admin/blog/${s.id}/edit`} className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <Send className="h-3.5 w-3.5 text-[hsl(var(--info))] flex-shrink-0" />
                  <span className="text-sm text-foreground truncate flex-1">{s.title}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {s.scheduled_at ? formatDistanceToNow(new Date(s.scheduled_at), { addSuffix: true }) : "Scheduled"}
                  </span>
                </Link>
              ))}
              {pipeline.recent.slice(0, 2).map((p: any) => (
                <Link key={p.id} to={`/admin/blog/${p.id}/edit`} className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success))] flex-shrink-0" />
                  <span className="text-sm text-foreground truncate flex-1">{p.title}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{p.view_count || 0} views</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
