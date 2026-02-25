import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Link } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, Eye } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminProductsPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ["admin-products", search],
    queryFn: async () => {
      let query = supabase.from("products").select("*, categories!products_category_id_fkey(name)").order("created_at", { ascending: false });
      if (search) query = query.ilike("name", `%${search}%`);
      const { data } = await query.limit(50);
      return data || [];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      const { error } = await supabase.from("products").update({ [field]: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-products"] }); toast.success("Updated"); },
    onError: () => toast.error("Failed to update"),
  });

  return (
    <>
      <SeoHead title="Products - Admin" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Products</h1>
            <p className="text-muted-foreground">{products?.length || 0} products total</p>
          </div>
          <Link to="/admin/products/new"><Button className="gap-1"><Plus className="h-4 w-4" />Add Product</Button></Link>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        <div className="product-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Product</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Category</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Rating</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Reviews</th>
                  <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Active</th>
                   <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Featured</th>
                   <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Sponsored</th>
                   <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products?.map((p: any) => (
                  <tr key={p.id} className="admin-table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {p.logo_url ? <img src={p.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-sm font-bold text-primary">{p.name.charAt(0)}</span>}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{p.pricing_model}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{p.categories?.name || "—"}</td>
                    <td className="px-4 py-3 text-sm font-medium">★ {Number(p.avg_rating).toFixed(1)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{p.total_reviews}</td>
                    <td className="px-4 py-3 text-center">
                      <Switch checked={p.is_active} onCheckedChange={(v) => toggleMutation.mutate({ id: p.id, field: "is_active", value: v })} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch checked={p.is_featured} onCheckedChange={(v) => toggleMutation.mutate({ id: p.id, field: "is_featured", value: v })} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch checked={p.is_sponsored} onCheckedChange={(v) => toggleMutation.mutate({ id: p.id, field: "is_sponsored", value: v })} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/product/${p.slug}`}><Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-3.5 w-3.5" /></Button></Link>
                        <Link to={`/admin/products/${p.id}/edit`}><Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button></Link>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>}
                {!isLoading && products?.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No products found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
