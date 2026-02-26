import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, ArrowUp, Eye, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { ProductLogo } from "@/components/ProductLogo";

export default function TechStacksPage() {
  const { user } = useAuth();

  const { data: stacks = [], isLoading } = useQuery({
    queryKey: ["tech-stacks-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tech_stacks")
        .select("*, tech_stack_items(id, product_id, role_description, products(id, name, slug, logo_url))")
        .eq("is_published", true)
        .order("upvote_count", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["stack-profiles", stacks.map((s: any) => s.user_id)],
    enabled: stacks.length > 0,
    queryFn: async () => {
      const userIds = [...new Set(stacks.map((s: any) => s.user_id))];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", userIds);
      return data || [];
    },
  });

  const profileMap = Object.fromEntries(profiles.map((p: any) => [p.user_id, p]));

  return (
    <>
      <SeoHead title="Tech Stacks — SoftwareHub" description="Discover curated software stacks shared by the community." />
      <main className="container py-8 md:py-12 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-2">
              <Layers className="h-7 w-7 text-primary" /> Tech Stacks
            </h1>
            <p className="text-muted-foreground mt-1">See what tools teams are using together</p>
          </div>
          {user && (
            <Link to="/dashboard?tab=stacks">
              <Button className="gap-1.5"><Plus className="h-4 w-4" /> Create Stack</Button>
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : stacks.length === 0 ? (
          <div className="text-center py-20">
            <Layers className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No stacks yet</h2>
            <p className="text-sm text-muted-foreground mb-4">Be the first to share your tech stack!</p>
            {user && (
              <Link to="/dashboard?tab=stacks">
                <Button>Create a Stack</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {stacks.map((stack: any, i: number) => {
              const author = profileMap[stack.user_id];
              const items = stack.tech_stack_items || [];
              return (
                <motion.div key={stack.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Link to={`/stacks/${stack.slug}`}>
                    <Card className="border-border/50 hover:border-primary/30 transition-all group cursor-pointer">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="min-w-0">
                            <h3 className="font-bold text-foreground group-hover:text-primary transition-colors truncate">{stack.title}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              by {author?.name || "Anonymous"}
                              {stack.category && <> · <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{stack.category}</Badge></>}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                            <span className="flex items-center gap-0.5"><ArrowUp className="h-3 w-3" />{stack.upvote_count}</span>
                            <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{stack.view_count}</span>
                          </div>
                        </div>
                        {stack.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{stack.description}</p>
                        )}
                        <div className="flex items-center gap-1 flex-wrap">
                          {items.slice(0, 6).map((item: any) => (
                            <div key={item.id} className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden" title={item.products?.name}>
                              <ProductLogo name={item.products?.name || ""} logoUrl={item.products?.logo_url} size="xs" />
                            </div>
                          ))}
                          {items.length > 6 && (
                            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                              +{items.length - 6}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
