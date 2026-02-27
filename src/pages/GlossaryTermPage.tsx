import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { motion } from "framer-motion";
import { BookOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlossaryTermPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: term, isLoading } = useQuery({
    queryKey: ["glossary-term", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("glossary_terms")
        .select("*")
        .eq("slug", slug!)
        .eq("is_published", true)
        .single();
      return data;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return <main className="container py-10 max-w-3xl"><div className="animate-pulse space-y-4"><div className="h-10 w-64 bg-muted rounded-lg" /><div className="h-4 w-full bg-muted/60 rounded" /><div className="h-32 w-full bg-muted/40 rounded-xl" /></div></main>;
  }

  if (!term) {
    return <main className="container py-20 text-center"><h1 className="text-2xl font-bold text-foreground">Term not found</h1></main>;
  }

  const relatedTerms = Array.isArray(term.related_terms) ? term.related_terms : [];

  return (
    <>
      <SeoHead
        title={`${term.term} — SaaS Glossary`}
        description={term.definition}
        canonicalUrl={`${window.location.origin}/glossary/${slug}`}
        keywords={`${term.term}, ${term.term} definition, ${term.category || "SaaS"} glossary`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "DefinedTerm",
          "name": term.term,
          "description": term.definition,
          "url": `${window.location.origin}/glossary/${slug}`,
          ...(term.category && { "inDefinedTermSet": { "@type": "DefinedTermSet", "name": `${term.category} Glossary` } })
        }}
      />
      <main className="container py-10 max-w-3xl">
        <Link to="/glossary">
          <Button variant="ghost" size="sm" className="gap-1.5 mb-6 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Glossary
          </Button>
        </Link>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">{term.term}</h1>
              {term.category && <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{term.category}</span>}
            </div>
          </div>

          <div className="glass-card p-6 mb-6">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Definition</h2>
            <p className="text-foreground leading-relaxed">{term.definition}</p>
          </div>

          {term.extended_description && (
            <div className="prose prose-sm max-w-none text-muted-foreground mb-6" dangerouslySetInnerHTML={{ __html: term.extended_description }} />
          )}

          {relatedTerms.length > 0 && (
            <div>
              <h2 className="text-lg font-display font-bold text-foreground mb-3">Related Terms</h2>
              <div className="flex flex-wrap gap-2">
                {relatedTerms.map((rt: any, i: number) => (
                  <Link key={i} to={`/glossary/${typeof rt === "string" ? rt : rt.slug}`} className="px-3 py-1.5 rounded-lg bg-muted/50 text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                    {typeof rt === "string" ? rt : rt.term}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </>
  );
}
