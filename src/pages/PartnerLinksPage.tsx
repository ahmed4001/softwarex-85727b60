import { SeoHead } from "@/components/SeoHead";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink } from "lucide-react";

interface PartnerLink {
  id: string;
  name: string;
  url: string;
  description: string | null;
  logo_url: string | null;
  sort_order: number;
}

export default function PartnerLinksPage() {
  const { data: partners, isLoading } = useQuery({
    queryKey: ["partner-links"],
    queryFn: async () => {
      const { data } = await supabase
        .from("partner_links")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return (data || []) as PartnerLink[];
    },
    staleTime: 1000 * 60 * 10,
  });

  return (
    <>
      <SeoHead
        title="Partner Links | Acclaim Arena"
        description="Discover our trusted partner websites and resources in the software review space."
      />
      <div className="container py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Partner Links</h1>
        <p className="text-muted-foreground mb-8">
          Discover our trusted partners and recommended resources.
        </p>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : !partners?.length ? (
          <p className="text-muted-foreground text-center py-16">
            No partner links available yet.
          </p>
        ) : (
          <div className="space-y-4">
            {partners.map((partner) => (
              <a
                key={partner.id}
                href={partner.url}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-4 p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all group"
              >
                {partner.logo_url ? (
                  <img
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
        )}
      </div>
    </>
  );
}
