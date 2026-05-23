import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";

interface Section {
  heading: string;
  body: string;
  bullets: string[];
}

interface Faq {
  q: string;
  a: string;
}

interface InternalLink {
  label: string;
  href: string;
}

interface Props {
  h1: string;
  meta_description: string;
  hero_body: string;
  featured_image: string;
  excerpt?: string;
  sections: Section[];
  faq: Faq[];
  internal_links: InternalLink[];
  slug: string;
  page_type: string;
}

const PREFIX: Record<string, string> = {
  keyword: "",
  feature: "/features",
  use_case: "/use-cases",
  industry: "/industry",
  template: "/templates",
};

export function KeywordPagePreview({
  h1,
  meta_description,
  hero_body,
  featured_image,
  excerpt,
  sections,
  faq,
  internal_links,
  slug,
  page_type,
}: Props) {
  const path = `${PREFIX[page_type] || ""}/${slug || "your-slug"}`;
  const cleanFaq = (faq || []).filter((f) => f.q || f.a);
  const cleanSections = (sections || []).filter((s) => s.heading || s.body || (s.bullets && s.bullets.length));

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      {/* Fake browser chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="flex-1 text-center text-xs text-muted-foreground font-mono truncate">
          yourdomain.com{path}
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto">
        <div className="container max-w-4xl py-8 px-6">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-6">
            <span>Home</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{h1 || "Untitled"}</span>
          </nav>

          {/* Hero */}
          <section className="py-6 md:py-10 text-center">
            <h1 className="text-3xl md:text-5xl font-display font-bold text-foreground tracking-tight max-w-3xl mx-auto">
              {h1 || "Your H1 headline appears here"}
            </h1>
            {meta_description && (
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">{meta_description}</p>
            )}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" className="gap-2" type="button">
                Try it now <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" type="button">Compare alternatives</Button>
            </div>
          </section>

          {/* Featured image */}
          {featured_image && (
            <div className="my-8 rounded-xl overflow-hidden border border-border">
              <img src={featured_image} alt={h1} className="w-full h-auto" />
            </div>
          )}

          {/* Hero body */}
          {hero_body && (
            <div
              className="prose prose-sm md:prose-base max-w-3xl mx-auto text-muted-foreground mb-12 dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: hero_body }}
            />
          )}

          {/* Sections */}
          {cleanSections.length > 0 && (
            <div className="space-y-10 mb-12">
              {cleanSections.map((s, i) => (
                <section key={i}>
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-3">
                    {s.heading || "Untitled section"}
                  </h2>
                  {s.body && (
                    <div className="prose prose-sm md:prose-base max-w-none text-muted-foreground dark:prose-invert">
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
                </section>
              ))}
            </div>
          )}

          {/* FAQ */}
          {cleanFaq.length > 0 && (
            <section className="mb-12 max-w-3xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-6">Frequently asked</h2>
              <Accordion type="single" collapsible className="w-full">
                {cleanFaq.map((f, i) => (
                  <AccordionItem key={i} value={`pf-${i}`} className="border-border">
                    <AccordionTrigger className="text-left font-semibold text-foreground hover:text-primary hover:no-underline py-4">
                      {f.q || "Question"}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                      {f.a || "Answer"}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          )}

          {/* Internal links */}
          {internal_links && internal_links.length > 0 && (
            <section className="border-t border-border pt-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Explore more</h3>
              <div className="flex flex-wrap gap-2">
                {internal_links.map((l, i) =>
                  l?.href ? (
                    <Button key={i} variant="outline" size="sm" type="button">
                      {l.label || l.href}
                    </Button>
                  ) : null
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
