import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Search } from "lucide-react";

export default function GlossaryPage() {
  const [search, setSearch] = useState("");

  const { data: terms = [], isLoading } = useQuery({
    queryKey: ["glossary-terms"],
    queryFn: async () => {
      const { data } = await supabase
        .from("glossary_terms")
        .select("id, term, slug, definition, category")
        .eq("is_published", true)
        .order("term");
      return data || [];
    },
  });

  const filtered = search.trim()
    ? terms.filter((t: any) => t.term.toLowerCase().includes(search.toLowerCase()) || t.definition.toLowerCase().includes(search.toLowerCase()))
    : terms;

  // Group by first letter
  const grouped = filtered.reduce((acc: Record<string, any[]>, t: any) => {
    const letter = t.term.charAt(0).toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(t);
    return acc;
  }, {});

  const letters = Object.keys(grouped).sort();

  return (
    <>
      <SeoHead title="SaaS Glossary — Software Terms & Definitions" description="Browse our comprehensive glossary of SaaS and software terms, definitions, and explanations." />
      <main className="container py-10 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">SaaS Glossary</h1>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">Definitions for common software and SaaS terminology</p>
        </motion.div>

        <div className="relative max-w-md mx-auto mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search terms..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        {/* Letter nav */}
        <div className="flex flex-wrap gap-1 justify-center mb-8">
          {letters.map((l) => (
            <a key={l} href={`#letter-${l}`} className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center text-sm font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
              {l}
            </a>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}</div>
        ) : letters.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No terms found.</p>
        ) : (
          <div className="space-y-8">
            {letters.map((letter) => (
              <div key={letter} id={`letter-${letter}`}>
                <h2 className="text-2xl font-display font-bold text-primary mb-3">{letter}</h2>
                <div className="space-y-2">
                  {grouped[letter].map((term: any) => (
                    <Link key={term.id} to={`/glossary/${term.slug}`} className="block glass-card p-4 hover:border-primary/30 transition-colors">
                      <h3 className="font-semibold text-foreground">{term.term}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{term.definition}</p>
                      {term.category && <span className="inline-block mt-2 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{term.category}</span>}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
