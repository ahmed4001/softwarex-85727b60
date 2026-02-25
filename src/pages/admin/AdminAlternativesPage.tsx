import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, ArrowLeftRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

type AlternativeRow = {
  id: string;
  product_id: string;
  alternative_product_id: string;
  similarity_score: number | null;
  product?: { name: string; slug: string; logo_url: string | null };
  alternative?: { name: string; slug: string; logo_url: string | null };
};

export default function AdminAlternativesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AlternativeRow | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [altSearch, setAltSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null);
  const [selectedAlt, setSelectedAlt] = useState<{ id: string; name: string } | null>(null);
  const [similarity, setSimilarity] = useState([75]);

  const { data: alternatives = [], isLoading } = useQuery({
    queryKey: ["admin-alternatives"],
    queryFn: async () => {
      const { data } = await supabase
        .from("alternatives")
        .select("*, product:products!alternatives_product_id_fkey(name, slug, logo_url), alternative:products!alternatives_alternative_product_id_fkey(name, slug, logo_url)")
        .order("similarity_score", { ascending: false });
      return (data || []) as AlternativeRow[];
    },
  });

  const { data: productResults = [] } = useQuery({
    queryKey: ["product-search", productSearch],
    enabled: productSearch.length > 1,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").ilike("name", `%${productSearch}%`).limit(8);
      return data || [];
    },
  });

  const { data: altResults = [] } = useQuery({
    queryKey: ["alt-search", altSearch],
    enabled: altSearch.length > 1,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").ilike("name", `%${altSearch}%`).limit(8);
      return data || [];
    },
  });

  const filtered = search.trim()
    ? alternatives.filter((a) =>
        (a.product?.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (a.alternative?.name || "").toLowerCase().includes(search.toLowerCase())
      )
    : alternatives;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProduct || !selectedAlt) throw new Error("Select both products");
      if (selectedProduct.id === selectedAlt.id) throw new Error("Cannot compare a product with itself");
      const { error } = await supabase.from("alternatives").insert({
        product_id: selectedProduct.id,
        alternative_product_id: selectedAlt.id,
        similarity_score: similarity[0] / 100,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-alternatives"] });
      setEditorOpen(false);
      setSelectedProduct(null);
      setSelectedAlt(null);
      setProductSearch("");
      setAltSearch("");
      toast.success("Alternative added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alternatives").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-alternatives"] });
      setDeleteTarget(null);
      toast.success("Alternative removed");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const ProductPicker = ({
    label, searchVal, setSearchVal, results, selected, setSelected,
  }: {
    label: string; searchVal: string; setSearchVal: (v: string) => void;
    results: { id: string; name: string }[]; selected: { id: string; name: string } | null;
    setSelected: (v: { id: string; name: string } | null) => void;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      {selected ? (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm font-medium text-foreground flex-1">{selected.name}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelected(null)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <>
          <Input placeholder="Search products..." value={searchVal} onChange={(e) => setSearchVal(e.target.value)} />
          {results.length > 0 && (
            <div className="border border-border rounded-lg max-h-40 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                  onClick={() => { setSelected(p); setSearchVal(""); }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      <SeoHead title="Alternatives - Admin" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ArrowLeftRight className="h-6 w-6" /> Product Alternatives
            </h1>
            <p className="text-muted-foreground">{alternatives.length} alternative pairs</p>
          </div>
          <Button className="gap-1" onClick={() => setEditorOpen(true)}>
            <Plus className="h-4 w-4" /> Add Pair
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search alternatives..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        <div className="product-card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Product A</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">↔</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Product B</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-4 py-3">Similarity</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="admin-table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {a.product?.logo_url ? <img src={a.product.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-primary">{a.product?.name?.charAt(0)}</span>}
                      </div>
                      <span className="text-sm font-medium text-foreground">{a.product?.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center"><ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground mx-auto" /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {a.alternative?.logo_url ? <img src={a.alternative.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-primary">{a.alternative?.name?.charAt(0)}</span>}
                      </div>
                      <span className="text-sm font-medium text-foreground">{a.alternative?.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-medium">{((Number(a.similarity_score) || 0) * 100).toFixed(0)}%</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(a)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No alternatives found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Alternative Pair</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <ProductPicker label="Product A" searchVal={productSearch} setSearchVal={setProductSearch} results={productResults} selected={selectedProduct} setSelected={setSelectedProduct} />
            <ProductPicker label="Product B (Alternative)" searchVal={altSearch} setSearchVal={setAltSearch} results={altResults} selected={selectedAlt} setSelected={setSelectedAlt} />
            <div className="space-y-2">
              <Label>Similarity Score: {similarity[0]}%</Label>
              <Slider value={similarity} onValueChange={setSimilarity} min={0} max={100} step={5} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!selectedProduct || !selectedAlt || createMutation.isPending} className="gap-1">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Alternative</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the link between <strong>{deleteTarget?.product?.name}</strong> and <strong>{deleteTarget?.alternative?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
