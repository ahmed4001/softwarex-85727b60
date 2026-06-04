import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/reviewhunts-logo.png.asset.json";


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
        .order("product_count", { ascending: false })
        .limit(10);
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  // Split dynamic pages into company vs policies by known slugs
  const policySlugs = ["terms", "privacy", "community-guidelines", "trust", "refund-policy"];
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
        { to: "/partners", label: "Partner Links" },
        { to: "/pricing", label: "Pricing" },
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-8 gap-y-10 mb-12">
          {/* ReviewHunts - 1 col */}
          <div>
            <div className="flex items-center gap-2 mb-5">
              <div className="h-4 w-4 rounded bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-[8px] font-bold text-white">★</span>
              </div>
              <h4 className="font-bold text-white text-sm">{footerSections[0].title}</h4>
            </div>
            <div className="space-y-2.5">
              {footerSections[0].links.map((l, i) => (
                <Link key={`${l.label}-${i}`} to={l.to} className="block text-sm text-white/50 hover:text-white transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Top Categories - 2 cols */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-4 w-4 rounded bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-[8px] font-bold text-white">★</span>
              </div>
              <h4 className="font-bold text-white text-sm">{footerSections[1].title}</h4>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
              {footerSections[1].links.map((l, i) => (
                <Link key={`${l.label}-${i}`} to={l.to} className="block text-sm text-white/50 hover:text-white transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Company - 1 col */}
          <div>
            <div className="flex items-center gap-2 mb-5">
              <div className="h-4 w-4 rounded bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-[8px] font-bold text-white">★</span>
              </div>
              <h4 className="font-bold text-white text-sm">{footerSections[2].title}</h4>
            </div>
            <div className="space-y-2.5">
              {footerSections[2].links.map((l, i) => (
                <Link key={`${l.label}-${i}`} to={l.to} className="block text-sm text-white/50 hover:text-white transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Policies - 1 col */}
          <div>
            <div className="flex items-center gap-2 mb-5">
              <div className="h-4 w-4 rounded bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-[8px] font-bold text-white">★</span>
              </div>
              <h4 className="font-bold text-white text-sm">{footerSections[3].title}</h4>
            </div>
            <div className="space-y-2.5">
              {footerSections[3].links.map((l, i) => (
                <Link key={`${l.label}-${i}`} to={l.to} className="block text-sm text-white/50 hover:text-white transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/30">
          <Link to="/" aria-label="ReviewHunts" className="flex items-center">
            <img
              src={logoAsset.url}
              alt="ReviewHunts"
              className="h-7 w-auto object-contain brightness-0 invert opacity-80 hover:opacity-100 transition-opacity"
            />
          </Link>
          <span>{t("footer.copyright", { year: new Date().getFullYear() })}</span>
        </div>
      </div>
    </footer>
  );
}
