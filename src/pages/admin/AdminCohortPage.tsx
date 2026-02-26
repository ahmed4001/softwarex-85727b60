import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BarChart3, Star, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";

export default function AdminCohortPage() {
  // Signups per month
  const { data: signupCohorts = [] } = useQuery({
    queryKey: ["admin-cohort-signups"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("created_at")
        .order("created_at");
      if (!data) return [];
      const buckets: Record<string, number> = {};
      data.forEach((p: any) => {
        const month = format(new Date(p.created_at), "yyyy-MM");
        buckets[month] = (buckets[month] || 0) + 1;
      });
      return Object.entries(buckets).map(([month, count]) => ({ month, count }));
    },
  });

  // Reviews per month
  const { data: reviewCohorts = [] } = useQuery({
    queryKey: ["admin-cohort-reviews"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("created_at")
        .order("created_at");
      if (!data) return [];
      const buckets: Record<string, number> = {};
      data.forEach((r: any) => {
        const month = format(new Date(r.created_at), "yyyy-MM");
        buckets[month] = (buckets[month] || 0) + 1;
      });
      return Object.entries(buckets).map(([month, count]) => ({ month, count }));
    },
  });

  // Top reviewers
  const { data: topReviewers = [] } = useQuery({
    queryKey: ["admin-cohort-top-reviewers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name, review_count, total_points, created_at")
        .order("review_count", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  return (
    <>
      <SeoHead title="User Cohort Analysis — Admin" />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Users className="h-6 w-6" /> User Cohort Analysis</h1>
          <p className="text-muted-foreground">Signups, review activity, and retention by cohort</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Signups by Month</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={signupCohorts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4" /> Reviews by Month</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={reviewCohorts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Top Reviewers</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">#</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Name</th>
                  <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Reviews</th>
                  <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Points</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {topReviewers.map((u: any, i: number) => (
                  <tr key={i} className="admin-table-row">
                    <td className="px-4 py-3 text-sm font-bold text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{u.name || "Unknown"}</td>
                    <td className="px-4 py-3 text-sm text-center">{u.review_count || 0}</td>
                    <td className="px-4 py-3 text-sm text-center text-primary">{u.total_points || 0}</td>
                    <td className="px-4 py-3 text-sm text-right text-muted-foreground">{format(new Date(u.created_at), "MMM yyyy")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
