import { SeoHead } from "@/components/SeoHead";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Handshake, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";

interface PartnerLink {
  id: string;
  name: string;
  url: string;
  description: string | null;
  logo_url: string | null;
  sort_order: number;
}

const applicationSchema = z.object({
  website_name: z.string().trim().min(1, "Website name is required").max(100),
  website_url: z.string().trim().url("Please enter a valid URL").max(500),
  contact_email: z.string().trim().email("Please enter a valid email").max(255),
  message: z.string().trim().max(1000).optional(),
});

export default function PartnerLinksPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ website_name: "", website_url: "", contact_email: "", message: "" });

  const { data: partners, isLoading } = useQuery({
    queryKey: ["partner-links"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("partner_links")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return (data || []) as PartnerLink[];
    },
    staleTime: 1000 * 60 * 10,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = applicationSchema.safeParse(form);
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase as any)
      .from("partner_applications")
      .insert([result.data]);
    setSubmitting(false);
    if (error) {
      toast.error("Failed to submit. Please try again.");
    } else {
      setSubmitted(true);
      toast.success("Application submitted successfully!");
    }
  };

  return (
    <>
      <SeoHead
        title="Partner Links | Acclaim Arena"
        description="Discover our trusted partner websites and apply to become a partner."
      />
      <div className="container py-12 max-w-4xl">
        {/* Hero */}
        <div className="flex items-center gap-3 mb-2">
          <Handshake className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Partner Links</h1>
        </div>
        <p className="text-muted-foreground mb-10 max-w-2xl">
          We collaborate with trusted websites and platforms in the software industry. 
          Explore our partners below or apply to join our network.
        </p>

        {/* Partner list */}
        {isLoading ? (
          <div className="space-y-4 mb-16">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : partners && partners.length > 0 ? (
          <div className="space-y-4 mb-16">
            {partners.map((partner) => (
              <a
                key={partner.id}
                href={partner.url}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-4 p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all group"
              >
                {partner.logo_url ? (
                  <img decoding="async" loading="lazy"
                    src={partner.logo_url}
                    alt={partner.name}
                    className="w-12 h-12 rounded-lg object-contain bg-muted p-1 flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-primary">
                      {partner.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {partner.name}
                  </h2>
                  {partner.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {partner.description}
                    </p>
                  )}
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              </a>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-12 mb-16 border border-dashed border-border rounded-xl">
            No partner links listed yet. Be the first to apply!
          </p>
        )}

        {/* Application form */}
        <div className="border border-border rounded-2xl p-8 bg-card">
          <div className="flex items-center gap-2 mb-1">
            <Send className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Become a Partner</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Interested in a link exchange or partnership? Fill out the form below and we'll get back to you.
          </p>

          {submitted ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Handshake className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Application Received!</h3>
              <p className="text-sm text-muted-foreground">
                Thank you for your interest. We'll review your application and get back to you soon.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="website_name">Website Name *</Label>
                  <Input
                    id="website_name"
                    placeholder="My Awesome Site"
                    value={form.website_name}
                    onChange={(e) => setForm({ ...form, website_name: e.target.value })}
                    required
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website_url">Website URL *</Label>
                  <Input
                    id="website_url"
                    type="url"
                    placeholder="https://example.com"
                    value={form.website_url}
                    onChange={(e) => setForm({ ...form, website_url: e.target.value })}
                    required
                    maxLength={500}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact Email *</Label>
                <Input
                  id="contact_email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  required
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message (optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Tell us about your website and why you'd like to partner..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  maxLength={1000}
                  rows={4}
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? "Submitting..." : "Submit Application"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
