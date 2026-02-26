import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent } from "@/components/ui/card";
import { Compass, ArrowRight, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function BuyerGuidesListPage() {
  const { data: guides = [], isLoading } = useQuery({
    queryKey: ["buyer-guides-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("buyer_guides")
        .select("id, title, slug, description, view_count, completion_count, category_id, categories(name)")
        .eq("is_published", true)
        .order("view_count", { ascending: false });
      return data || [];
    },
  });

  return (
    <>
      <SeoHead title="Buyer Guides — SoftwareHub" description="Interactive guides to help you find the perfect software." />
      <main className="container py-8 md:py-12 max-w-4xl">
        <div className="text-center mb-10">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Compass className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Buyer Guides</h1>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">Answer a few questions and get personalized software recommendations.</p>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted/30 animate-pulse" />)}
          </div>
        ) : guides.length === 0 ? (
          <div className="text-center py-16">
            <Compass className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No guides available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {guides.map((g: any, i: number) => (
              <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Link to={`/guides/${g.slug}`}>
                  <Card className="border-border/50 hover:border-primary/30 transition-all group cursor-pointer h-full">
                    <CardContent className="p-5 flex flex-col h-full">
                      <h3 className="font-bold text-foreground group-hover:text-primary transition-colors mb-1">{g.title}</h3>
                      {g.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-1">{g.description}</p>}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{g.view_count}</span>
                          <span>{g.completion_count} completed</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
