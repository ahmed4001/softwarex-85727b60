import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function PublicFooter() {
  const { t } = useTranslation();

  const footerSections = [
    {
      title: t("footer.softwareHub"),
      links: [
        { to: "/category/all", label: t("footer.browseSoftware") },
        { to: "/blog", label: t("footer.learningHub") },
        { to: "/category/all", label: t("footer.softwareReviews") },
        { to: "/search", label: t("footer.researchHub") },
        { to: "/compare", label: t("footer.compareSoftware") },
        { to: "/category/all", label: t("footer.bestCompanies") },
      ],
    },
    {
      title: t("footer.topCategories"),
      links: [
        { to: "/category/ai-chatbots", label: t("categories.aiChatbots") },
        { to: "/category/crm", label: t("categories.crm") },
        { to: "/category/project-management", label: t("categories.projectManagement") },
        { to: "/category/expense-management", label: t("categories.expenseManagement") },
        { to: "/category/video-conferencing", label: t("categories.videoConferencing") },
        { to: "/category/e-commerce", label: t("categories.eCommerce") },
        { to: "/category/accounting", label: t("categories.accounting") },
        { to: "/category/erp", label: t("categories.erp") },
        { to: "/category/marketing-automation", label: t("categories.marketingAutomation") },
        { to: "/category/all", label: t("categories.allCategories") },
      ],
    },
    {
      title: t("footer.company"),
      links: [
        { to: "/page/about", label: t("footer.about") },
        { to: "/page/contact", label: t("footer.contact") },
        { to: "/blog", label: t("footer.news") },
        { to: "/page/about", label: t("footer.careers") },
      ],
    },
    {
      title: t("footer.policies"),
      links: [
        { to: "/page/community-guidelines", label: t("footer.communityGuidelines") },
        { to: "/page/terms", label: t("footer.terms") },
        { to: "/page/privacy", label: t("footer.privacy") },
        { to: "/page/trust", label: t("footer.trust") },
      ],
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
