import { SeoHead } from "@/components/SeoHead";
import { Link } from "react-router-dom";
import { ShieldCheck, Users, Database, RefreshCw, Scale, CheckCircle2 } from "lucide-react";

const LAST_UPDATED = "2026-07-01";
const SITE_URL = "https://reviewhunts.com";

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How ReviewHunts Reviews Software — Editorial Methodology",
  description:
    "The full editorial methodology behind ReviewHunts: reviewer verification, data sources, scoring model, editorial independence, and update cadence.",
  author: { "@type": "Organization", name: "ReviewHunts Editorial Team", url: SITE_URL },
  publisher: { "@type": "Organization", name: "ReviewHunts", url: SITE_URL, logo: { "@type": "ImageObject", url: `${SITE_URL}/reviewhunts-logo.png` } },
  datePublished: "2024-01-15",
  dateModified: LAST_UPDATED,
  mainEntityOfPage: `${SITE_URL}/methodology`,
};

export default function MethodologyPage() {
  return (
    <>
      <SeoHead
        title="Our Review Methodology"
        description="How ReviewHunts sources reviews, verifies reviewers, and ranks software. Editorial independence, data sources, scoring model, and update cadence."
        canonicalUrl="/methodology"
        author="ReviewHunts Editorial Team"
        type="article"
        jsonLd={articleJsonLd}
      />
      <main className="container max-w-3xl py-12 md:py-20">
        <p className="t-eyebrow mb-2 inline-flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Editorial Standards
        </p>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">How we review software</h1>
        <p className="text-sm text-muted-foreground mb-8">
          By the <span className="text-foreground font-medium">ReviewHunts Editorial Team</span> ·{" "}
          <time dateTime={LAST_UPDATED}>
            Last updated {new Date(LAST_UPDATED).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </time>
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <p className="lead text-lg text-foreground/80">
            ReviewHunts is an independent SaaS discovery platform. Our mission is to help buyers make confident software decisions using data that is honest, current, and impossible to game. This page explains exactly how we do it.
          </p>

          <h2 className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Reviewer verification</h2>
          <ul>
            <li>Every reviewer confirms a work email, current job title, and company.</li>
            <li>Suspicious patterns (matching IPs, template language, burst voting) are flagged for manual moderation.</li>
            <li>Optional verification: LinkedIn profile linking and domain-based employment checks add an "Enhanced Verified" badge.</li>
            <li>We never accept anonymous reviews.</li>
          </ul>

          <h2 className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" /> Data sources</h2>
          <p>Product records combine four data streams:</p>
          <ul>
            <li><strong>First-party reviews</strong> written by verified users on ReviewHunts.</li>
            <li><strong>Vendor-supplied metadata</strong> (pricing, features, integrations) which vendors can maintain via the vendor portal.</li>
            <li><strong>Public web enrichment</strong> for logos, screenshots, and changelogs.</li>
            <li><strong>AI-assisted summarization</strong> that consolidates verified reviews into pros/cons and sentiment themes — never fabricated content.</li>
          </ul>

          <h2 className="flex items-center gap-2"><Scale className="h-5 w-5 text-primary" /> Scoring & ranking</h2>
          <p>
            A product's overall score blends its average verified rating, review recency, review volume, and an internal quality signal (<code>info_score</code>) that measures the completeness of its listing. Rankings within a category are re-computed nightly. Sponsored placements are visually labeled <strong>AD</strong> and do not affect a product's underlying score.
          </p>

          <h2 className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /> Editorial independence</h2>
          <ul>
            <li>Rankings are never sold. Vendors cannot pay to raise their score.</li>
            <li>Affiliate links, where present, are disclosed and do not influence editorial coverage.</li>
            <li>Editors are not compensated based on vendor outcomes.</li>
          </ul>

          <h2 className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" /> Update cadence</h2>
          <ul>
            <li>Reviews are published in real time after moderation.</li>
            <li>Pricing data is refreshed monthly.</li>
            <li>Vendor-managed listings update immediately on save.</li>
            <li>Buyer guides and comparisons are reviewed at least every 6 months.</li>
          </ul>

          <h2>Corrections</h2>
          <p>
            Spot something wrong? Email <a href="mailto:hello@reviewhunts.com">hello@reviewhunts.com</a> or use the "Report an issue" link on any product page. We respond within 2 business days.
          </p>

          <p className="mt-10">
            <Link to="/" className="text-primary font-semibold hover:underline">← Back to ReviewHunts</Link>
          </p>
        </div>
      </main>
    </>
  );
}
