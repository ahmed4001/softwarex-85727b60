import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MessageSquare, UserPlus, Package, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";

type FeedItem = {
  id: string;
  type: "review" | "product" | "comment";
  title: string;
  description: string;
  link?: string;
  userName: string;
  timestamp: string;
};

export default function ActivityFeedPage() {
  const { data: feed = [], isLoading } = useQuery({
    queryKey: ["public-activity-feed"],
    queryFn: async () => {
      const items: FeedItem[] = [];

      // Recent approved reviews
      const { data: reviews } = await supabase
        .from("reviews")
        .select("id, title, overall_rating, created_at, products(name, slug), profiles(name)")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(15);

      (reviews || []).forEach((r: any) => {
        items.push({
          id: `review-${r.id}`,
          type: "review",
          title: `Reviewed ${r.products?.name || "a product"}`,
          description: r.title || `Rated ${r.overall_rating}/5 stars`,
          link: r.products?.slug ? `/product/${r.products.slug}` : undefined,
          userName: r.profiles?.name || "Anonymous",
          timestamp: r.created_at,
        });
      });

      // Recently added products
      const { data: products } = await supabase
        .from("products")
        .select("id, name, slug, tagline, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(10);

      (products || []).forEach((p: any) => {
        items.push({
          id: `product-${p.id}`,
          type: "product",
          title: `New product listed: ${p.name}`,
          description: p.tagline || "No description",
          link: `/product/${p.slug}`,
          userName: "SoftwareHub",
          timestamp: p.created_at,
        });
      });

      // Recent comments
      const { data: comments } = await supabase
        .from("review_comments")
        .select("id, body, created_at, profiles(name)")
        .order("created_at", { ascending: false })
        .limit(10);

      (comments || []).forEach((c: any) => {
        items.push({
          id: `comment-${c.id}`,
          type: "comment",
          title: "Left a comment on a review",
          description: (c.body || "").slice(0, 100),
          userName: c.profiles?.name || "Anonymous",
          timestamp: c.created_at,
        });
      });

      // Sort by timestamp
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return items.slice(0, 30);
    },
  });

  const iconMap = {
    review: { icon: Star, color: "text-amber-500", bg: "bg-amber-500/10" },
    product: { icon: Package, color: "text-primary", bg: "bg-primary/10" },
    comment: { icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-500/10" },
  };

  return (
    <>
      <SeoHead title="Activity Feed" description="See the latest activity on SoftwareHub" />
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-2">
            <Activity className="h-7 w-7" /> Activity Feed
          </h1>
          <p className="text-muted-foreground">See what's happening across the platform</p>
        </div>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-4">
            {feed.map((item) => {
              const cfg = iconMap[item.type];
              const Icon = cfg.icon;
              return (
                <div key={item.id} className="relative pl-14">
                  <div className={`absolute left-3 top-4 h-7 w-7 rounded-full ${cfg.bg} flex items-center justify-center z-10`}>
                    <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                  </div>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="secondary" className="text-xs">{item.userName}</Badge>
                            {item.link && (
                              <Link to={item.link} className="text-xs text-primary hover:underline">View →</Link>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
            {isLoading && <p className="text-center text-muted-foreground py-8">Loading activity...</p>}
            {!isLoading && feed.length === 0 && <p className="text-center text-muted-foreground py-8">No activity yet.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
