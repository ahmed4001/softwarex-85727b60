import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { ListCard } from "@/components/ListCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Plus, Search, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function ListsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"upvotes" | "newest">("upvotes");

  const { data: lists, isLoading } = useQuery({
    queryKey: ["lists", sort, search],
    queryFn: async () => {
      let q = supabase
        .from("lists")
        .select("*")
        .eq("is_published", true);

      if (search.trim()) {
        q = q.ilike("title", `%${search.trim()}%`);
      }

      if (sort === "upvotes") {
        q = q.order("upvote_count", { ascending: false });
      } else {
        q = q.order("created_at", { ascending: false });
      }

      const { data, error } = await q.limit(50);
      if (error) throw error;

      // Fetch creator names
      const userIds = [...new Set((data || []).map((l: any) => l.user_id))];
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, name")
          .in("user_id", userIds);
        (profiles || []).forEach((p: any) => { profilesMap[p.user_id] = p.name; });
      }

      return (data || []).map((l: any) => ({ ...l, creator_name: profilesMap[l.user_id] || null }));
    },
  });

  // Fetch product logos for each list
  const listIds = lists?.map((l: any) => l.id) || [];
  const { data: itemsMap } = useQuery({
    queryKey: ["list-items-logos", listIds],
    enabled: listIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("list_items")
        .select("list_id, products(logo_url)")
        .in("list_id", listIds)
        .order("sort_order", { ascending: true })
        .limit(200);

      const map: Record<string, string[]> = {};
      (data || []).forEach((item: any) => {
        if (!map[item.list_id]) map[item.list_id] = [];
        if (item.products?.logo_url && map[item.list_id].length < 4) {
          map[item.list_id].push(item.products.logo_url);
        }
      });
      return map;
    },
  });

  return (
    <>
      <SeoHead title="Curated Software Lists" description="Browse user-curated software lists and collections" />
      <main className="container py-10 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-foreground">Software Lists</h1>
            <p className="text-muted-foreground mt-1">Community-curated software collections</p>
          </div>
          {user && (
            <Link to="/lists/new">
              <Button className="gap-2"><Plus className="h-4 w-4" /> Create List</Button>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search lists..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1">
            <Button variant={sort === "upvotes" ? "default" : "outline"} size="sm" onClick={() => setSort("upvotes")}>
              Top
            </Button>
            <Button variant={sort === "newest" ? "default" : "outline"} size="sm" onClick={() => setSort("newest")}>
              New
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !lists || lists.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-lg font-bold text-foreground mb-1">No lists yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Be the first to create a curated list!</p>
            {user && (
              <Link to="/lists/new"><Button className="gap-2"><Plus className="h-4 w-4" /> Create List</Button></Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {lists.map((list: any) => (
              <ListCard
                key={list.id}
                id={list.id}
                slug={list.slug}
                title={list.title}
                description={list.description}
                upvoteCount={list.upvote_count}
                productCount={list.product_count}
                creatorName={list.creator_name}
                productLogos={itemsMap?.[list.id] || []}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
