import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function PublicFooter() {
  const { t } = useTranslation();

  const { data: footerPages } = useQuery({
    queryKey: ["footer-pages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pages")
        .select("slug, title")
        .eq("is_active", true)
        .eq("show_in_footer", true)
        .order("title");
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: featuredCategories } = useQuery({
    queryKey: ["footer-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("slug, name")
        .eq("is_active", true)
        .eq("is_featured", true)
        .order("sort_order")
        .limit(10);
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  // Split dynamic pages into company vs policies by known slugs
  const policySlugs = ["terms", "privacy", "community-guidelines", "trust"];
  const companyPages = (footerPages || []).filter(p => !policySlugs.includes(p.slug));
  const policyPages = (footerPages || []).filter(p => policySlugs.includes(p.slug));

  const categoryLinks = (featuredCategories || []).map(c => ({
    to: `/category/${c.slug}`,
    label: c.name,
  }));
  categoryLinks.push({ to: "/categories", label: t("categories.allCategories") });

  const footerSections = [
    {
      title: t("footer.softwareHub"),
      links: [
        { to: "/categories", label: t("footer.browseSoftware") },
        { to: "/blog", label: t("footer.learningHub") },
        { to: "/categories", label: t("footer.softwareReviews") },
        { to: "/search", label: t("footer.researchHub") },
        { to: "/compare", label: t("footer.compareSoftware") },
        { to: "/categories", label: t("footer.bestCompanies") },
      ],
    },
    {
      title: t("footer.topCategories"),
      links: categoryLinks,
    },
    {
      title: t("footer.company"),
      links: [
        ...companyPages.map(p => ({ to: `/page/${p.slug}`, label: p.title })),
        { to: "/blog", label: t("footer.news") },
      ],
    },
    {
      title: t("footer.policies"),
      links: policyPages.map(p => ({ to: `/page/${p.slug}`, label: p.title })),
    },
  ];

  return (
    <footer className="bg-foreground text-white/70">
      <div className="container py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {footerSections.map((section) => (
            <div key={section.title}>
              <div className="flex items-center gap-2 mb-5">
                <div className="h-4 w-4 rounded bg-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-[8px] font-bold text-white">★</span>
                </div>
                <h4 className="font-bold text-white text-sm">{section.title}</h4>
              </div>
              <div className="space-y-2.5">
                {section.links.map((l, i) => (
                  <Link
                    key={`${l.label}-${i}`}
                    to={l.to}
                    className="block text-sm text-white/50 hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/30">
          <span>{t("footer.copyright", { year: new Date().getFullYear() })}</span>
        </div>
      </div>
    </footer>
  );
}
