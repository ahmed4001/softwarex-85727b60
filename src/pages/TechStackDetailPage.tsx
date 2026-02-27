import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUp, Eye, Layers, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ProductLogo } from "@/components/ProductLogo";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function TechStackDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const { data: stack, isLoading } = useQuery({
    queryKey: ["tech-stack-detail", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("tech_stacks")
        .select("*, tech_stack_items(id, product_id, role_description, sort_order, products(id, name, slug, logo_url, tagline, avg_rating))")
        .eq("slug", slug!)
        .eq("is_published", true)
        .single();
      return data;
    },
    enabled: !!slug,
  });

  const { data: author } = useQuery({
    queryKey: ["stack-author", stack?.user_id],
    enabled: !!stack?.user_id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("name, avatar_url").eq("user_id", stack!.user_id).single();
      return data;
    },
  });

  const { data: hasVoted, refetch: refetchVote } = useQuery({
    queryKey: ["stack-vote", stack?.id, user?.id],
    enabled: !!stack?.id && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("tech_stack_votes")
        .select("id")
        .eq("stack_id", stack!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const handleVote = async () => {
    if (!user) return toast.error("Sign in to vote");
    if (!stack) return;
    if (hasVoted) {
      await supabase.from("tech_stack_votes").delete().eq("stack_id", stack.id).eq("user_id", user.id);
    } else {
      await supabase.from("tech_stack_votes").insert({ stack_id: stack.id, user_id: user.id });
    }
    refetchVote();
  };

  if (isLoading) {
    return <div className="container py-12 max-w-3xl"><div className="h-64 rounded-xl bg-muted/30 animate-pulse" /></div>;
  }

  if (!stack) {
    return <div className="container py-12 text-center"><h2 className="text-xl font-bold">Stack not found</h2></div>;
  }

  const items = (stack.tech_stack_items || []).sort((a: any, b: any) => a.sort_order - b.sort_order);

  // JSON-LD for tech stacks
  const stackJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": stack.title,
    "description": stack.description || `A curated tech stack`,
    "url": `${window.location.origin}/stacks/${slug}`,
    "numberOfItems": items.length,
    "itemListElement": items.map((item: any, i: number) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": {
        "@type": "SoftwareApplication",
        "name": item.products?.name || "Software",
        "description": item.role_description || item.products?.tagline,
        ...(item.products?.logo_url && { "image": item.products.logo_url }),
      }
    }))
  };

  return (
    <>
      <SeoHead
        title={`${stack.title} — Tech Stack`}
        description={stack.description || `A curated tech stack on SoftwareHub`}
        canonicalUrl={`${window.location.origin}/stacks/${slug}`}
        jsonLd={stackJsonLd}
      />
      <main className="container py-8 md:py-12 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">{stack.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                by {author?.name || "Anonymous"}
                {stack.category && <> · <Badge variant="secondary">{stack.category}</Badge></>}
              </p>
            </div>
            <Button variant={hasVoted ? "default" : "outline"} size="sm" onClick={handleVote} className="gap-1.5">
              <ArrowUp className="h-4 w-4" /> {stack.upvote_count}
            </Button>
          </div>

          {stack.description && (
            <p className="text-muted-foreground mb-8">{stack.description}</p>
          )}

          <div className="space-y-3">
            {items.map((item: any, i: number) => (
              <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <Link to={`/product/${item.products?.slug}`}>
                  <Card className="border-border/50 hover:border-primary/30 transition-all group">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        <ProductLogo name={item.products?.name || ""} logoUrl={item.products?.logo_url} size="sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{item.products?.name}</h3>
                        <p className="text-xs text-muted-foreground">{item.role_description || item.products?.tagline}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors flex-shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>
    </>
  );
}
