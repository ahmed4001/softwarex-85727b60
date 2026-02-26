import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ProductLogo } from "@/components/ProductLogo";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Users, Star } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  productIds: string[];
}

export function VendorCompetitorBenchmark({ productIds }: Props) {
  const { data: benchmark } = useQuery({
    queryKey: ["vendor-competitor-benchmark", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      // Get our products' categories
      const { data: ours } = await supabase
        .from("products")
        .select("id, name, slug, logo_url, avg_rating, total_reviews, category_id, view_count")
        .in("id", productIds);

      if (!ours || ours.length === 0) return null;

      const categoryIds = [...new Set(ours.map((p) => p.category_id).filter(Boolean))];
      if (categoryIds.length === 0) return null;

      // Get top competitors in same categories
      const { data: competitors } = await supabase
        .from("products")
        .select("id, name, slug, logo_url, avg_rating, total_reviews, view_count")
        .in("category_id", categoryIds as string[])
        .eq("is_active", true)
        .not("id", "in", `(${productIds.join(",")})`)
        .order("total_reviews", { ascending: false })
        .limit(5);

      // Build chart data
      const all = [...ours, ...(competitors || [])].map((p) => ({
        name: p.name.length > 15 ? p.name.slice(0, 15) + "…" : p.name,
        rating: Number(p.avg_rating) || 0,
        reviews: p.total_reviews || 0,
        isOurs: productIds.includes(p.id),
      }));

      return {
        products: ours,
        competitors: competitors || [],
        chartData: all.sort((a, b) => b.rating - a.rating).slice(0, 8),
      };
    },
  });

  if (!benchmark || benchmark.chartData.length < 2) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Competitor Benchmark</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={benchmark.chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(value: number) => [value.toFixed(1), "Rating"]}
              />
              <Bar
                dataKey="rating"
                radius={[0, 6, 6, 0]}
                fill="hsl(var(--primary))"
                label={false}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 justify-center text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Star className="h-3 w-3 text-[hsl(var(--star))]" /> Your avg: {benchmark.products.length > 0 ? (benchmark.products.reduce((s, p) => s + Number(p.avg_rating || 0), 0) / benchmark.products.length).toFixed(1) : "—"}</span>
            <span>vs Category avg: {benchmark.competitors.length > 0 ? (benchmark.competitors.reduce((s, p) => s + Number(p.avg_rating || 0), 0) / benchmark.competitors.length).toFixed(1) : "—"}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
