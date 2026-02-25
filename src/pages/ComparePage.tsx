import { SeoHead } from "@/components/SeoHead";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StarRating } from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { X, Plus, Check, Minus, ArrowRight, Calculator, BarChart3, Layers, Crown, ArrowLeftRight, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PaginationControls } from "@/components/PaginationControls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAX_PRODUCTS = 4;
const PAGE_SIZE = 24;

export default function ComparePage() {
  const [searchParams] = useSearchParams();
  const initialIds = searchParams.get("products")?.split(",").filter(Boolean) || [];
  const [productIds, setProductIds] = useState<string[]>(initialIds);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [teamSize, setTeamSize] = useState([10]);
  const [months, setMonths] = useState([12]);
  const { t } = useTranslation();

  // Directory state
  const [dirSearch, setDirSearch] = useState("");
  const [dirCategory, setDirCategory] = useState("all");
  const [dirPage, setDirPage] = useState(0);

  // Fetch total count for pagination
  const { data: totalCount } = useQuery({
    queryKey: ["comparisons-count", dirSearch, dirCategory],
    queryFn: async () => {
      let query = supabase
        .from("comparisons")
        .select("id", { count: "exact", head: true })
        .eq("is_published", true);

      if (dirSearch.trim()) {
        query = query.ilike("title", `%${dirSearch.trim()}%`);
      }
      if (dirCategory !== "all") {
        query = query.eq("category_id", dirCategory);
      }

      const { count } = await query;
      return count || 0;
    },
  });

  // Fetch paginated comparisons
  const { data: comparisons, isLoading: comparisonsLoading } = useQuery({
    queryKey: ["comparisons-directory", dirSearch, dirCategory, dirPage],
    queryFn: async () => {
      let query = supabase
        .from("comparisons")
        .select("id, title, slug, product_ids, view_count, summary, category_id, product_a_score, product_b_score, winner_verdict")
        .eq("is_published", true)
        .order("view_count", { ascending: false })
        .range(dirPage * PAGE_SIZE, (dirPage + 1) * PAGE_SIZE - 1);

      if (dirSearch.trim()) {
        query = query.ilike("title", `%${dirSearch.trim()}%`);
      }
      if (dirCategory !== "all") {
        query = query.eq("category_id", dirCategory);
      }

      const { data } = await query;
      return data || [];
    },
  });

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ["categories-for-compare-filter"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);

  // Manual compare tool queries
  const { data: products } = useQuery({
    queryKey: ["compare-products", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      const { data } = await supabase
        .from("products")
        .select("*, categories!products_category_id_fkey(name)")
        .in("id", productIds);
      return data || [];
    },
    enabled: productIds.length > 0,
  });

  const { data: allProducts } = useQuery({
    queryKey: ["all-products-for-compare"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, logo_url, avg_rating, tagline")
        .eq("is_active", true)
        .order("name")
        .limit(500);
      return data || [];
    },
  });

  const filteredSearch = useMemo(() => {
    if (!allProducts || !searchQuery.trim()) return allProducts || [];
    const q = searchQuery.toLowerCase();
    return allProducts.filter(
      (p) => !productIds.includes(p.id) && (p.name.toLowerCase().includes(q) || p.tagline?.toLowerCase().includes(q))
    );
  }, [allProducts, searchQuery, productIds]);

  const addProduct = (id: string) => {
    if (productIds.length < MAX_PRODUCTS && !productIds.includes(id)) {
      setProductIds([...productIds, id]);
      setSearchQuery("");
      setShowSearch(false);
    }
  };

  const removeProduct = (id: string) => setProductIds(productIds.filter((pid) => pid !== id));

  const allFeatures = useMemo(() => {
    if (!products) return [];
    const featureSet = new Set<string>();
    products.forEach((p) => {
      const features = Array.isArray(p.features) ? p.features : [];
      features.forEach((f: string) => featureSet.add(f));
    });
    return [...featureSet].sort();
  }, [products]);

  const bestProduct = useMemo(() => {
    if (!products || products.length === 0) return null;
    return products.reduce((best, p) => (Number(p.avg_rating) > Number(best.avg_rating) ? p : best));
  }, [products]);

  return (
    <>
      <SeoHead title="Software Comparisons — Side-by-Side Reviews" description="Browse 1000+ head-to-head software comparisons. Find out which tool is best for your team with detailed feature matrices and pricing calculators." />

      <div className="container py-8 max-w-6xl">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground mb-2">{t("comparePage.title")}</h1>
          <p className="text-muted-foreground">{t("comparePage.subtitle", { max: MAX_PRODUCTS })}</p>
        </motion.div>

        {/* Manual compare tool */}
        <div className="glass-card p-6 mb-10">
          <div className="flex flex-wrap items-center gap-3">
            {products?.map((p) => (
              <motion.div key={p.id} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2 pr-2">
                <div className="h-8 w-8 rounded-lg bg-card flex items-center justify-center overflow-hidden">
                  {p.logo_url ? <img src={p.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-primary">{p.name.charAt(0)}</span>}
                </div>
                <span className="text-sm font-semibold text-foreground">{p.name}</span>
                <button onClick={() => removeProduct(p.id)} className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ))}

            {productIds.length < MAX_PRODUCTS && (
              <div className="relative">
                <Button variant="outline" size="sm" onClick={() => setShowSearch(!showSearch)} className="gap-1.5 rounded-xl border-dashed">
                  <Plus className="h-4 w-4" /> {t("comparePage.addProduct")}
                </Button>

                <AnimatePresence>
                  {showSearch && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="absolute top-full left-0 mt-2 w-72 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden">
                      <div className="p-3 border-b border-border">
                        <Input placeholder={t("comparePage.searchProducts")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus className="text-sm" />
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {filteredSearch.slice(0, 20).map((p) => (
                          <button key={p.id} onClick={() => addProduct(p.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors">
                            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                              {p.logo_url ? <img src={p.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-primary">{p.name.charAt(0)}</span>}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{p.tagline}</p>
                            </div>
                          </button>
                        ))}
                        {filteredSearch.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">{t("comparePage.noProductsFound")}</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Manual comparison results */}
        {products && products.length >= 2 && (
          <div className="space-y-8 mb-16">
            <section>
              <SectionLabel icon={<BarChart3 className="h-4 w-4" />} label={t("comparePage.overview")} />
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${products.length}, minmax(0, 1fr))` }}>
                {products.map((p) => (
                  <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("glass-card p-5 text-center relative", bestProduct?.id === p.id && "ring-2 ring-primary/30")}>
                    {bestProduct?.id === p.id && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                        <Crown className="h-3 w-3" /> {t("comparePage.bestRated")}
                      </div>
                    )}
                    <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center overflow-hidden mx-auto mb-3">
                      {p.logo_url ? <img src={p.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xl font-bold text-primary">{p.name.charAt(0)}</span>}
                    </div>
                    <h3 className="font-bold text-foreground mb-1">{p.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{p.tagline}</p>
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      <StarRating rating={Number(p.avg_rating)} size="sm" />
                      <span className="text-sm font-bold">{Number(p.avg_rating).toFixed(1)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.total_reviews} {t("product.reviews").toLowerCase()}</p>
                    <Link to={`/product/${p.slug}`}>
                      <Button variant="ghost" size="sm" className="mt-3 text-xs gap-1">
                        {t("comparePage.viewDetails")} <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </section>

            <section>
              <SectionLabel icon={<Layers className="h-4 w-4" />} label={t("comparePage.detailedComparison")} />
              <div className="glass-card overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-48">{t("comparePage.attribute")}</th>
                      {products.map((p) => (
                        <th key={p.id} className="text-center py-3 px-4 text-sm font-semibold text-foreground">{p.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <CompareRow label={t("comparePage.rating")} products={products} render={(p) => (
                      <div className="flex items-center justify-center gap-1.5">
                        <StarRating rating={Number(p.avg_rating)} size="sm" />
                        <span className="font-bold text-sm">{Number(p.avg_rating).toFixed(1)}</span>
                      </div>
                    )} />
                    <CompareRow label={t("comparePage.totalReviews")} products={products} render={(p) => <span className="font-medium">{p.total_reviews || 0}</span>} />
                    <CompareRow label={t("comparePage.pricingModel")} products={products} render={(p) => <Badge variant="outline" className="capitalize">{p.pricing_model || "—"}</Badge>} />
                    <CompareRow label={t("comparePage.startingPrice")} products={products} render={(p) => (
                      <span className="font-bold">{p.starting_price ? `$${p.starting_price}${t("product.perMonth")}` : "—"}</span>
                    )} />
                    <CompareRow label={t("comparePage.category")} products={products} render={(p) => <span className="text-sm">{(p.categories as any)?.name || "—"}</span>} />
                    <CompareRow label={t("comparePage.companySize")} products={products} render={(p) => <span>{p.company_size || "—"}</span>} />
                    <CompareRow label={t("comparePage.founded")} products={products} render={(p) => <span>{p.founded_year || "—"}</span>} />
                    <CompareRow label={t("comparePage.headquarters")} products={products} render={(p) => <span>{p.headquarters || "—"}</span>} />
                    <CompareRow label={t("comparePage.verified")} products={products} render={(p) => (
                      p.is_verified ? <Check className="h-4 w-4 text-[hsl(var(--success))] mx-auto" /> : <Minus className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                    )} />
                  </tbody>
                </table>
              </div>
            </section>

            {allFeatures.length > 0 && (
              <section>
                <SectionLabel icon={<Check className="h-4 w-4" />} label={t("comparePage.featureMatrix")} />
                <div className="glass-card overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-48">{t("comparePage.feature")}</th>
                        {products.map((p) => (
                          <th key={p.id} className="text-center py-3 px-4 text-sm font-semibold text-foreground">{p.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allFeatures.map((feature) => (
                        <tr key={feature} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-5 text-sm text-foreground font-medium">{feature}</td>
                          {products.map((p) => {
                            const has = Array.isArray(p.features) && p.features.includes(feature);
                            return (
                              <td key={p.id} className="py-2.5 px-4 text-center">
                                {has ? (
                                  <div className="h-6 w-6 rounded-full bg-[hsl(var(--success)/0.1)] flex items-center justify-center mx-auto">
                                    <Check className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
                                  </div>
                                ) : (
                                  <Minus className="h-4 w-4 text-muted-foreground/20 mx-auto" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {products.some((p) => p.pros_summary || p.cons_summary) && (
              <section>
                <SectionLabel icon={<BarChart3 className="h-4 w-4" />} label={t("comparePage.prosCons")} />
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${products.length}, minmax(0, 1fr))` }}>
                  {products.map((p) => (
                    <div key={p.id} className="space-y-3">
                      <h4 className="font-semibold text-sm text-foreground text-center">{p.name}</h4>
                      {p.pros_summary && (
                        <div className="glass-card p-4 border-l-4 border-l-[hsl(var(--success))]">
                          <p className="text-xs font-bold text-[hsl(var(--success))] uppercase mb-1">{t("product.pros")}</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{p.pros_summary}</p>
                        </div>
                      )}
                      {p.cons_summary && (
                        <div className="glass-card p-4 border-l-4 border-l-destructive">
                          <p className="text-xs font-bold text-destructive uppercase mb-1">{t("product.cons")}</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{p.cons_summary}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <SectionLabel icon={<Calculator className="h-4 w-4" />} label={t("comparePage.pricingCalculator")} />
              <div className="glass-card p-6">
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">{t("comparePage.teamSize", { count: teamSize[0] })}</label>
                    <Slider value={teamSize} onValueChange={setTeamSize} min={1} max={500} step={1} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">{t("comparePage.duration", { count: months[0] })}</label>
                    <Slider value={months} onValueChange={setMonths} min={1} max={36} step={1} />
                  </div>
                </div>

                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${products.length}, minmax(0, 1fr))` }}>
                  {products.map((p) => {
                    const monthlyPerUser = p.starting_price || 0;
                    const monthlyCost = monthlyPerUser * teamSize[0];
                    const totalCost = monthlyCost * months[0];
                    const isCheapest = products.every((other) => (other.starting_price || 0) >= (p.starting_price || 0));

                    return (
                      <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("glass-card p-5 text-center", isCheapest && products.length > 1 && "ring-2 ring-primary/30")}>
                        {isCheapest && products.length > 1 && (
                          <Badge className="mb-2 bg-primary/10 text-primary border-0 text-[10px]">{t("comparePage.bestValue")}</Badge>
                        )}
                        <h4 className="font-bold text-foreground mb-3">{p.name}</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between text-muted-foreground">
                            <span>{t("comparePage.perUserMo")}</span>
                            <span className="font-semibold text-foreground">{monthlyPerUser ? `$${monthlyPerUser}` : t("comparePage.free")}</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>{t("comparePage.monthlyUsers", { count: teamSize[0] })}</span>
                            <span className="font-semibold text-foreground">${monthlyCost.toLocaleString()}</span>
                          </div>
                          <div className="border-t border-border pt-2 flex justify-between">
                            <span className="font-semibold text-foreground">{t("comparePage.totalCost", { count: months[0] })}</span>
                            <span className="font-extrabold text-primary text-lg">${totalCost.toLocaleString()}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ===== Comparisons Directory ===== */}
        <div className="border-t border-border pt-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 mb-6">
            <div>
              <p className="text-sm font-semibold text-primary mb-1">Browse All</p>
              <h2 className="text-xl md:text-2xl font-extrabold text-foreground">
                Software Comparisons {totalCount ? <span className="text-muted-foreground font-medium text-base">({totalCount.toLocaleString()})</span> : null}
              </h2>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search comparisons..."
                value={dirSearch}
                onChange={(e) => { setDirSearch(e.target.value); setDirPage(0); }}
                className="pl-9"
              />
            </div>
            <Select value={dirCategory} onValueChange={(v) => { setDirCategory(v); setDirPage(0); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Grid */}
          {comparisonsLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-card p-5 animate-pulse">
                  <div className="h-4 w-3/4 bg-muted rounded mb-3" />
                  <div className="h-3 w-full bg-muted/60 rounded mb-2" />
                  <div className="h-3 w-1/2 bg-muted/40 rounded" />
                </div>
              ))}
            </div>
          ) : comparisons && comparisons.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {comparisons.map((c, i) => {
                const title = c.title || "Comparison";
                const parts = title.split(" vs ");
                const a = parts[0] || "";
                const b = parts[1] || "";

                return (
                  <motion.article
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  >
                    <Link
                      to={`/compare/${c.slug || c.id}`}
                      className="glass-card p-5 flex flex-col gap-3 group hover:ring-1 hover:ring-primary/20 transition-all"
                      aria-label={`Compare ${a} vs ${b}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">{a.charAt(0)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                            {title}
                          </p>
                          {c.winner_verdict && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{c.winner_verdict}</p>
                          )}
                        </div>
                        <ArrowLeftRight className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
                      </div>

                      {(c.product_a_score || c.product_b_score) && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-foreground">{a.split(" ")[0]}: {Number(c.product_a_score).toFixed(1)}</span>
                          <span className="text-muted-foreground">vs</span>
                          <span className="font-semibold text-foreground">{b.split(" ")[0]}: {Number(c.product_b_score).toFixed(1)}</span>
                        </div>
                      )}

                      {c.summary && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{c.summary.substring(0, 120)}...</p>
                      )}

                      {c.view_count > 0 && (
                        <span className="text-[11px] text-muted-foreground/50">{c.view_count.toLocaleString()} views</span>
                      )}
                    </Link>
                  </motion.article>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <ArrowLeftRight className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground">No comparisons found</p>
            </div>
          )}

          {/* Pagination */}
          <PaginationControls
            page={dirPage}
            totalPages={totalPages}
            onPageChange={setDirPage}
            className="mt-8"
          />
        </div>
      </div>
    </>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">{icon}</div>
      <h3 className="font-bold text-foreground">{label}</h3>
    </div>
  );
}

function CompareRow({ label, products, render }: { label: string; products: any[]; render: (p: any) => React.ReactNode }) {
  return (
    <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
      <td className="py-3 px-5 text-sm text-muted-foreground font-medium">{label}</td>
      {products.map((p) => (
        <td key={p.id} className="py-3 px-4 text-center text-sm">
          {render(p)}
        </td>
      ))}
    </tr>
  );
}
