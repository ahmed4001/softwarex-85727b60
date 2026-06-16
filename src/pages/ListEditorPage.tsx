import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import { SeoHead } from "@/components/SeoHead";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, X, Search, GripVertical } from "lucide-react";

interface ListItem {
  product_id: string;
  name: string;
  logo_url?: string;
  note: string;
  sort_order: number;
}

export default function ListEditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const isEdit = !!slug;
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [items, setItems] = useState<ListItem[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // Load existing list for edit
  const { data: existingList, isLoading: loadingList } = useQuery({
    queryKey: ["list-edit", slug],
    enabled: isEdit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lists")
        .select("*")
        .eq("slug", slug!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: existingItems } = useQuery({
    queryKey: ["list-edit-items", existingList?.id],
    enabled: !!existingList?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("list_items")
        .select("*, products(name, logo_url)")
        .eq("list_id", existingList!.id)
        .order("sort_order", { ascending: true });
      return data || [];
    },
  });

  useEffect(() => {
    if (existingList) {
      setTitle(existingList.title);
      setDescription(existingList.description || "");
      setCoverImage(existingList.cover_image || "");
      setIsPublished(existingList.is_published);
    }
  }, [existingList]);

  useEffect(() => {
    if (existingItems) {
      setItems(existingItems.map((item: any) => ({
        product_id: item.product_id,
        name: item.products?.name || "",
        logo_url: item.products?.logo_url,
        note: item.note || "",
        sort_order: item.sort_order,
      })));
    }
  }, [existingItems]);

  // Product search
  const { data: searchResults } = useQuery({
    queryKey: ["product-search-list", productSearch],
    enabled: productSearch.trim().length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, logo_url")
        .eq("is_active", true)
        .ilike("name", `%${productSearch.trim()}%`)
        .limit(10);
      return (data || []).filter(p => !items.some(i => i.product_id === p.id));
    },
  });

  const generateSlug = (t: string) =>
    t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!title.trim()) throw new Error("Title is required");

      const listSlug = isEdit ? slug! : generateSlug(title) + "-" + Date.now().toString(36);

      if (isEdit) {
        // Update list
        const { error } = await supabase
          .from("lists")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            cover_image: coverImage.trim() || null,
            is_published: isPublished,
            product_count: items.length,
          })
          .eq("id", existingList!.id);
        if (error) throw error;

        // Delete existing items and re-insert
        await supabase.from("list_items").delete().eq("list_id", existingList!.id);

        if (items.length > 0) {
          const { error: itemsError } = await supabase.from("list_items").insert(
            items.map((item, i) => ({
              list_id: existingList!.id,
              product_id: item.product_id,
              note: item.note.trim() || null,
              sort_order: i,
            }))
          );
          if (itemsError) throw itemsError;
        }

        return listSlug;
      } else {
        // Create list
        const { data: newList, error } = await supabase
          .from("lists")
          .insert({
            user_id: user.id,
            title: title.trim(),
            slug: listSlug,
            description: description.trim() || null,
            cover_image: coverImage.trim() || null,
            is_published: isPublished,
            product_count: items.length,
          })
          .select("id")
          .single();
        if (error) throw error;

        if (items.length > 0) {
          await supabase.from("list_items").insert(
            items.map((item, i) => ({
              list_id: newList.id,
              product_id: item.product_id,
              note: item.note.trim() || null,
              sort_order: i,
            }))
          );
        }

        return listSlug;
      }
    },
    onSuccess: (savedSlug) => {
      toast.success(isEdit ? "List updated!" : "List created!");
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      navigate(`/lists/${savedSlug}`);
    },
    onError: (err: any) => toast.error(err.message || "Failed to save list"),
  });

  const addProduct = (product: { id: string; name: string; logo_url?: string | null }) => {
    setItems(prev => [...prev, {
      product_id: product.id,
      name: product.name,
      logo_url: product.logo_url || undefined,
      note: "",
      sort_order: prev.length,
    }]);
    setProductSearch("");
  };

  const removeProduct = (productId: string) => {
    setItems(prev => prev.filter(i => i.product_id !== productId));
  };

  const updateNote = (productId: string, note: string) => {
    setItems(prev => prev.map(i => i.product_id === productId ? { ...i, note } : i));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const newItems = [...items];
    const target = index + direction;
    if (target < 0 || target >= newItems.length) return;
    [newItems[index], newItems[target]] = [newItems[target], newItems[index]];
    setItems(newItems);
  };

  if (isEdit && loadingList) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <RequireAuth>
      <SeoHead
        title={isEdit ? "Edit List" : "Create New List"}
        description={
          isEdit
            ? "Edit your curated list of software tools on ReviewHunts — update items, ordering, and description."
            : "Create a new curated list of software tools on ReviewHunts. Group your favorite apps, add commentary, and share with the community."
        }
        robots="noindex, follow"
      />
      <main className="container py-10 max-w-2xl">
        <h1 className="text-2xl font-extrabold text-foreground mb-6">
          {isEdit ? "Edit List" : "Create New List"}
        </h1>

        <div className="space-y-5">
          <div>
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Best Tools for Startups 2026" className="mt-1" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this list about?" className="mt-1" rows={3} />
          </div>
          <div>
            <Label>Cover Image URL</Label>
            <Input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="https://..." className="mt-1" />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isPublished} onCheckedChange={setIsPublished} />
            <Label>Published</Label>
          </div>

          {/* Product picker */}
          <div>
            <Label>Products</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products to add..."
                className="pl-9"
              />
            </div>
            {searchResults && searchResults.length > 0 && (
              <div className="border border-border rounded-lg mt-1 bg-card max-h-48 overflow-y-auto">
                {searchResults.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className="flex items-center gap-3 w-full p-2.5 hover:bg-muted/50 text-left text-sm"
                  >
                    {p.logo_url ? (
                      <img src={p.logo_url} alt="" className="h-6 w-6 rounded object-cover" />
                    ) : (
                      <div className="h-6 w-6 rounded bg-muted flex items-center justify-center text-xs font-bold">{p.name[0]}</div>
                    )}
                    <span className="text-foreground">{p.name}</span>
                    <Plus className="h-4 w-4 text-muted-foreground ml-auto" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Item list */}
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.product_id} className="glass-card p-3 flex items-start gap-3">
                  <div className="flex flex-col gap-0.5 pt-1">
                    <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20">
                      <GripVertical className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="text-sm font-bold text-muted-foreground/40 mt-1 w-5">{idx + 1}</span>
                  {item.logo_url ? (
                    <img src={item.logo_url} alt="" className="h-8 w-8 rounded-md object-cover mt-0.5" />
                  ) : (
                    <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center text-xs font-bold mt-0.5">{item.name[0]}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.name}</p>
                    <Input
                      value={item.note}
                      onChange={(e) => updateNote(item.product_id, e.target.value)}
                      placeholder="Add a note (optional)"
                      className="mt-1 text-xs h-8"
                    />
                  </div>
                  <button onClick={() => removeProduct(item.product_id)} className="text-muted-foreground hover:text-destructive mt-1">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !title.trim()} className="w-full">
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? "Update List" : "Create List"}
          </Button>
        </div>
      </main>
    </RequireAuth>
  );
}
