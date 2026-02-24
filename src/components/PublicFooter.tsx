import { Link } from "react-router-dom";

const footerSections = [
  {
    title: "SoftwareHub",
    links: [
      { to: "/category/all", label: "Browse Software" },
      { to: "/blog", label: "Learning Hub" },
      { to: "/category/all", label: "Software Reviews" },
      { to: "/register", label: "Add Your Product" },
      { to: "/search", label: "Research Hub" },
      { to: "/compare", label: "Compare Software" },
      { to: "/category/all", label: "Best Software Companies" },
    ],
  },
  {
    title: "Top Categories",
    links: [
      { to: "/category/ai-chatbots", label: "AI Chatbots Software" },
      { to: "/category/crm", label: "CRM Software" },
      { to: "/category/project-management", label: "Project Management" },
      { to: "/category/expense-management", label: "Expense Management" },
      { to: "/category/video-conferencing", label: "Video Conferencing" },
      { to: "/category/e-commerce", label: "E-Commerce Platforms" },
      { to: "/category/accounting", label: "Accounting Software" },
      { to: "/category/erp", label: "ERP Systems" },
      { to: "/category/marketing-automation", label: "Marketing Automation" },
      { to: "/category/all", label: "All Categories" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/page/about", label: "About" },
      { to: "/page/contact", label: "Contact" },
      { to: "/blog", label: "News" },
      { to: "/page/about", label: "Careers" },
    ],
  },
  {
    title: "Policies",
    links: [
      { to: "/page/community-guidelines", label: "Community Guidelines" },
      { to: "/page/terms", label: "Terms of Use" },
      { to: "/page/privacy", label: "Privacy Policy" },
      { to: "/page/trust", label: "Trust & Security" },
    ],
  },
];

export function PublicFooter() {
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
          <span>© {new Date().getFullYear()} SoftwareHub. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
