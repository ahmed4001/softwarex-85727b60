import { ShieldCheck, Users, Database, RefreshCw, Scale, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

const LAST_UPDATED = "2026-07-01";

const PILLARS = [
  { icon: Users, title: "Verified reviewers", desc: "Every reviewer confirms their work email, role, and company before a review is published." },
  { icon: Database, title: "Multi-source data", desc: "Ratings blend first-party user reviews with public product data, then AI-assisted summarization." },
  { icon: Scale, title: "Editorial independence", desc: "Sponsored placements are labeled AD. Rankings are never sold — vendors can't pay for a higher score." },
  { icon: RefreshCw, title: "Kept current", desc: "Pricing refreshes monthly, product pages weekly, and vendor updates flow in real time." },
];

export function MethodologySection() {
  return (
    <section className="py-16 md:py-20 bg-muted/30" aria-labelledby="methodology-heading">
      <div className="container max-w-5xl">
        <div className="text-center mb-10">
          <p className="t-eyebrow mb-1 inline-flex items-center gap-2 justify-center">
            <ShieldCheck className="h-4 w-4 text-primary" /> Trust & Transparency
          </p>
          <h2 id="methodology-heading" className="t-h2">How we review software</h2>
          <p className="t-body mt-3 max-w-2xl mx-auto">
            ReviewHunts is an independent software discovery platform. Here's exactly how we source data, verify reviewers, and keep our rankings honest.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {PILLARS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-5 rounded-2xl border border-border bg-card">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-muted-foreground border-t border-border pt-5">
          <p>
            Reviewed by the <span className="text-foreground font-medium">ReviewHunts Editorial Team</span> ·{" "}
            <time dateTime={LAST_UPDATED}>
              Last updated {new Date(LAST_UPDATED).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </time>
          </p>
          <Link
            to="/methodology"
            className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
          >
            <BookOpen className="h-4 w-4" /> Read the full methodology
          </Link>
        </div>
      </div>
    </section>
  );
}
