import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SeoHead } from "@/components/SeoHead";
import { ListVoteButton } from "@/components/ListVoteButton";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Loader2, Edit, Trash2, Share2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function ListDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: list, isLoading } = useQuery({
    queryKey: ["list-detail", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lists")
        .select("*")
        .eq("slug", slug!)
        .single();
      if (error) throw error;

      // Fetch creator profile separately
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("user_id", data.user_id)
        .single();

      return { ...data, creator_name: profile?.name || null };
    },
  });

  const { data: items } = useQuery({
    queryKey: ["list-items", list?.id],
    enabled: !!list?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("list_items")
        .select("*, products!inner(*, categories!products_category_id_fkey(name))")
        .eq("list_id", list!.id)
        .order("sort_order", { ascending: true });
      return data || [];
    },
  });

  const deleteList = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lists").delete().eq("id", list!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("List deleted");
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      navigate("/lists");
    },
    onError: () => toast.error("Failed to delete list"),
  });

  const isOwner = user?.id === list?.user_id;

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!list) {
    return <div className="container py-20 text-center"><h2 className="text-xl font-bold">List not found</h2></div>;
  }

  return (
    <>
      <SeoHead title={list.title} description={list.description || `A curated list of ${list.product_count} software products`} />
      <main className="container py-10 max-w-4xl">
        <Link to="/lists" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Lists
        </Link>

        <div className="flex items-start gap-4 mb-8">
          <ListVoteButton listId={list.id} upvoteCount={list.upvote_count} />
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">{list.title}</h1>
            {list.description && <p className="text-muted-foreground mt-2">{list.description}</p>}
            <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
              <span>by {list.creator_name || "Anonymous"}</span>
              <span>·</span>
              <span>{list.product_count} products</span>
              <span>·</span>
              <span>{list.view_count} views</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}><Share2 className="h-4 w-4" /></Button>
            {isOwner && (
              <>
                <Link to={`/lists/${slug}/edit`}><Button variant="outline" size="sm"><Edit className="h-4 w-4" /></Button></Link>
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => deleteList.mutate()}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {!items || items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>No products in this list yet.</p>
            {isOwner && <Link to={`/lists/${slug}/edit`}><Button className="mt-4">Add Products</Button></Link>}
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item: any, idx: number) => (
              <div key={item.id} className="glass-card p-4">
                <div className="flex items-start gap-4">
                  <span className="text-lg font-bold text-muted-foreground/40 mt-1 w-6 text-center">{idx + 1}</span>
                  <div className="flex-1">
                    <ProductCard
                      id={item.products.id}
                      slug={item.products.slug}
                      name={item.products.name}
                      tagline={item.products.tagline}
                      logo_url={item.products.logo_url}
                      avg_rating={Number(item.products.avg_rating)}
                      total_reviews={item.products.total_reviews}
                      pricing_model={item.products.pricing_model}
                      category_name={item.products.categories?.name}
                      is_featured={item.products.is_featured}
                      is_sponsored={item.products.is_sponsored}
                    />
                    {item.note && (
                      <p className="text-sm text-muted-foreground mt-2 ml-1 italic">"{item.note}"</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
