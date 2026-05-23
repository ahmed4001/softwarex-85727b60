import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { ProductCard } from "@/components/ProductCard";
import { Breadcrumbs } from "@/components/blog/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { canonicalFor } from "@/lib/seo-canonical";
import NotFound from "./NotFound";

interface KeywordLandingPageProps {
  /** Force a specific page_type lookup. If omitted, slug must be unique across types. */
  pageType?: "keyword" | "feature" | "use_case" | "industry" | "template";
  /** Override slug (otherwise pulled from route param). */
  slugOverride?: string;
  /** Path prefix for canonical (e.g. "/features"). For root keyword pages, leave empty. */
  pathPrefix?: string;
}

export default function KeywordLandingPage({ pageType, slugOverride, pathPrefix = "" }: KeywordLandingPageProps) {
  const params = useParams();
  const slug = slugOverride || params.feature || params.slug || "";

  const { data: page, isLoading } = useQuery({
    queryKey: ["keyword-landing", pageType, slug],
    queryFn: async () => {
      let q = (supabase as any)
        .from("keyword_landing_pages")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true);
      if (pageType) q = q.eq("page_type", pageType);
      const { data } = await q.maybeSingle();
      return data;
    },
    enabled: !!slug,
  });

  const primaryId = page?.primary_product_id as string | undefined;
  const relatedIds = ((page?.related_product_ids as string[]) || []).filter(Boolean);
  const allIds = [primaryId, ...relatedIds].filter(Boolean) as string[];

  const { data: products = [] } = useQuery({
    queryKey: ["keyword-landing-products", allIds],
    queryFn: async () => {
      if (!allIds.length) return [];
      const { data } = await supabase
        .from("products")
        .select("*, categories!products_category_id_fkey(name)")
        .in("id", allIds)
        .eq("is_active", true);
      return data || [];
    },
    enabled: allIds.length > 0,
  });

  if (isLoading) {
    return <div className="container py-20 text-center text-muted-foreground">Loading…</div>;
  }
  if (!page) return <NotFound />;

  const primary = products.find((p: any) => p.id === primaryId);
  const related = products.filter((p: any) => p.id !== primaryId);
  const path = `${pathPrefix}/${page.slug}`;
  const faq = (page.faq as Array<{ q: string; a: string }>) || [];

  const jsonLd: object[] = [];
  if (faq.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }
  if (page.schema_jsonld) jsonLd.push(page.schema_jsonld as object);

  return (
    <>
      <SeoHead
        title={page.meta_title || page.h1}
        description={page.meta_description || ""}
        canonicalUrl={canonicalFor(path, page.canonical_override)}
        keywords={page.focus_keyword || ""}
        jsonLd={jsonLd}
        type="website"
      />
      <div className="container py-8 max-w-6xl">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: page.h1 }]} />

        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-10 md:py-16 text-center"
        >
          <h1 className="text-3xl md:text-5xl font-display font-bold text-foreground tracking-tight max-w-3xl mx-auto">
            {page.h1}
          </h1>
          {page.meta_description && (
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">{page.meta_description}</p>
          )}
          {primary && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to={`/product/${primary.slug}`}>
                <Button size="lg" className="gap-2">
                  Try {primary.name} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to={`/alternatives/${primary.slug}`}>
                <Button size="lg" variant="outline">Compare alternatives</Button>
              </Link>
            </div>
          )}
        </motion.section>

        {/* Hero body */}
        {page.hero_body && (
          <div className="prose prose-sm md:prose-base max-w-3xl mx-auto text-muted-foreground mb-12">
            <ReactMarkdown>{page.hero_body}</ReactMarkdown>
          </div>
        )}

        {/* Sections (features / benefits / etc) */}
        {Array.isArray(page.sections) && page.sections.length > 0 && (
          <div className="space-y-12 mb-16">
            {(page.sections as Array<{ heading: string; body: string; bullets?: string[] }>).map((s, i) => (
              <motion.section
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-3">{s.heading}</h2>
                {s.body && (
                  <div className="prose prose-sm md:prose-base max-w-none text-muted-foreground">
                    <ReactMarkdown>{s.body}</ReactMarkdown>
                  </div>
                )}
                {s.bullets && s.bullets.length > 0 && (
                  <ul className="mt-4 grid md:grid-cols-2 gap-3">
                    {s.bullets.map((b, j) => (
                      <li key={j} className="flex gap-2 text-sm text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.section>
            ))}
          </div>
        )}

        {/* Comparison grid */}
        {related.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-6">
              Top alternatives & related tools
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {related.map((p: any) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  slug={p.slug}
                  name={p.name}
                  tagline={p.tagline}
                  logo_url={p.logo_url}
                  avg_rating={Number(p.avg_rating)}
                  total_reviews={p.total_reviews}
                  pricing_model={p.pricing_model}
                  category_name={p.categories?.name}
                  is_featured={p.is_featured}
                  is_sponsored={p.is_sponsored}
                />
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        {faq.length > 0 && (
          <section className="mb-16 max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-6">Frequently asked</h2>
            <Accordion type="single" collapsible className="w-full">
              {faq.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-border">
                  <AccordionTrigger className="text-left font-semibold text-foreground hover:text-primary hover:no-underline py-4">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}

        {/* Internal link rail */}
        <section className="border-t border-border pt-8 mb-8">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Explore more</h3>
          <div className="flex flex-wrap gap-2">
            {((page.internal_links as Array<{ label: string; href: string }>) || []).map((l, i) => (
              l?.href ? (
                <Link key={`il-${i}`} to={l.href}>
                  <Button variant="outline" size="sm">{l.label || l.href}</Button>
                </Link>
              ) : null
            ))}
            {((page.related_comparison_slugs as string[]) || []).map((s) => (
              <Link key={s} to={`/compare/${s}`}>
                <Button variant="outline" size="sm">Compare: {s.replace(/-/g, " ")}</Button>
              </Link>
            ))}
            {((page.related_blog_slugs as string[]) || []).map((s) => (
              <Link key={s} to={`/blog/${s}`}>
                <Button variant="ghost" size="sm">Read: {s.replace(/-/g, " ")}</Button>
              </Link>
            ))}
            {page.related_category_id && (
              <Link to={`/category/${page.related_category_id}`}>
                <Button variant="ghost" size="sm">Browse category</Button>
              </Link>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
