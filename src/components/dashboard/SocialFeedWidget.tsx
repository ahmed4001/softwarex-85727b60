import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Star, MessageSquare, List, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ProductLogo } from "@/components/ProductLogo";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { useMemo } from "react";

export function SocialFeedWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["social-feed-widget"],
    queryFn: async () => {
      // Fetch recent community activity: reviews, lists, Q&A
      const [reviewsRes, listsRes] = await Promise.all([
        supabase
          .from("reviews")
          .select("id, title, overall_rating, created_at, user_id, products!reviews_product_id_fkey(name, slug, logo_url)")
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("lists")
          .select("id, title, slug, product_count, upvote_count, created_at, user_id")
          .eq("is_published", true)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      // Get profile names
      const userIds = new Set<string>();
      reviewsRes.data?.forEach((r) => userIds.add(r.user_id));
      listsRes.data?.forEach((l) => userIds.add(l.user_id));

      const profileMap: Record<string, string> = {};
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, name")
          .in("user_id", [...userIds]);
        profiles?.forEach((p) => {
          profileMap[p.user_id] = p.name || "Anonymous";
        });
      }

      // Merge into feed
      type FeedItem = { type: "review" | "list"; id: string; created_at: string; data: any; userName: string };
      const feed: FeedItem[] = [];

      reviewsRes.data?.forEach((r) => {
        feed.push({
          type: "review",
          id: r.id,
          created_at: r.created_at!,
          data: r,
          userName: profileMap[r.user_id] || "Anonymous",
        });
      });

      listsRes.data?.forEach((l) => {
        feed.push({
          type: "list",
          id: l.id,
          created_at: l.created_at,
          data: l,
          userName: profileMap[l.user_id] || "Anonymous",
        });
      });

      feed.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return feed.slice(0, 6);
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-foreground mb-1">Community Activity</h3>
        <p className="text-xs text-muted-foreground">No recent activity to show.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
        >
          {item.type === "review" ? (
            <Link
              to={`/product/${item.data.products?.slug}`}
              className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors group"
            >
              <ProductLogo
                name={item.data.products?.name || "?"}
                logoUrl={item.data.products?.logo_url}
                size="xs"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground">
                  <span className="font-semibold">{item.userName}</span>{" "}
                  <span className="text-muted-foreground">reviewed</span>{" "}
                  <span className="font-semibold group-hover:text-primary transition-colors">
                    {item.data.products?.name}
                  </span>
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star
                      key={s}
                      className={`h-2.5 w-2.5 ${s < item.data.overall_rating ? "text-[hsl(var(--star))] fill-[hsl(var(--star))]" : "text-muted-foreground/20"}`}
                    />
                  ))}
                  <span className="text-[10px] text-muted-foreground ml-1">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </Link>
          ) : (
            <Link
              to={`/lists/${item.data.slug}`}
              className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors group"
            >
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <List className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground">
                  <span className="font-semibold">{item.userName}</span>{" "}
                  <span className="text-muted-foreground">created</span>{" "}
                  <span className="font-semibold group-hover:text-primary transition-colors">
                    {item.data.title}
                  </span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {item.data.product_count} products · {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </p>
              </div>
            </Link>
          )}
        </motion.div>
      ))}
    </div>
  );
}
