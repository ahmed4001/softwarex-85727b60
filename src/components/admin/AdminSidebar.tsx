import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  ArrowLeftRight, BarChart3, Bot, Box, ChevronDown, DollarSign, FileText, FolderOpen,
  Image, LayoutDashboard, LogOut, Megaphone, MessageSquare, Settings,
  Star, Users, Activity, Mail, Database, Sparkles, Globe, Inbox, Compass, Shield,
  BookOpen, TrendingUp, UserCheck, Handshake, MousePointerClick, Tag
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
const logoAsset = { url: "/reviewhunts-logo.png" };

const sidebarItems = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/admin" },
  {
    label: "Products", icon: Box, children: [
      { label: "All Products", to: "/admin/products" },
      { label: "Add Product", to: "/admin/products/new" },
      { label: "Sponsored", to: "/admin/products/sponsored" },
    ]
  },
  {
    label: "Categories", icon: FolderOpen, children: [
      { label: "All Categories", to: "/admin/categories" },
      { label: "Add Category", to: "/admin/categories/new" },
    ]
  },
  {
    label: "Reviews", icon: Star, children: [
      { label: "All Reviews", to: "/admin/reviews" },
      { label: "Pending", to: "/admin/reviews/pending" },
      { label: "Flagged", to: "/admin/reviews/flagged" },
    ]
  },
  {
    label: "Users", icon: Users, children: [
      { label: "All Users", to: "/admin/users" },
    ]
  },
  {
    label: "Blog & CMS", icon: FileText, children: [
      { label: "Blog Posts", to: "/admin/blog" },
      { label: "Add Post", to: "/admin/blog/new" },
      { label: "SEO Dashboard", to: "/admin/blog/seo" },
      { label: "Pages", to: "/admin/pages" },
      { label: "SEO Landing Pages", to: "/admin/keyword-pages" },
      { label: "Landing Page Library", to: "/admin/landing-pages" },
      { label: "Buyer Guides", to: "/admin/buyer-guides" },
      { label: "Glossary", to: "/admin/glossary" },
    ]
  },
  { label: "Media Library", icon: Image, to: "/admin/media" },
  { label: "Advertisements", icon: Megaphone, to: "/admin/ads" },
  { label: "Deals", icon: Tag, to: "/admin/deals" },
  { label: "Pricing", icon: DollarSign, to: "/admin/pricing" },
  { label: "Comparisons", icon: ArrowLeftRight, to: "/admin/comparisons" },
  { label: "Submissions", icon: MessageSquare, to: "/admin/submissions" },
  { label: "Email Templates", icon: Mail, to: "/admin/emails" },
  { label: "Subscribers", icon: Inbox, to: "/admin/subscribers" },
  { label: "Analytics", icon: BarChart3, to: "/admin/analytics" },
  { label: "Settings", icon: Settings, to: "/admin/settings" },
  { label: "Activity Log", icon: Activity, to: "/admin/activity" },
  { label: "Seed Data", icon: Database, to: "/admin/seed" },
  { label: "AI Import", icon: Sparkles, to: "/admin/ai-import" },
  { label: "AI Integration", icon: Bot, to: "/admin/ai" },
  { label: "Sentiment", icon: Bot, to: "/admin/sentiment" },
  { label: "Translations", icon: Globe, to: "/admin/translations" },
  { label: "Alternatives", icon: ArrowLeftRight, to: "/admin/alternatives" },
  { label: "Import/Export", icon: Database, to: "/admin/import-export" },
  { label: "Broadcast", icon: Megaphone, to: "/admin/broadcast" },
  { label: "Brevo Email", icon: Mail, to: "/admin/brevo" },
  { label: "Moderation", icon: Shield, to: "/admin/moderation" },
  { label: "Trend Reports", icon: TrendingUp, to: "/admin/trend-reports" },
  { label: "Cohort Analysis", icon: UserCheck, to: "/admin/cohort" },
  { label: "Partner Links", icon: Handshake, to: "/admin/partner-links" },
  { label: "Affiliate Clicks", icon: MousePointerClick, to: "/admin/affiliate-analytics" },
];

interface SidebarItemProps {
  item: typeof sidebarItems[number];
  collapsed: boolean;
}

function SidebarItem({ item, collapsed }: SidebarItemProps) {
  const location = useLocation();
  const [open, setOpen] = useState(() => {
    if ("children" in item && item.children) return item.children.some((c) => location.pathname.startsWith(c.to));
    return false;
  });
  const isActive = "to" in item && item.to ? location.pathname === item.to : "children" in item && item.children?.some((c) => location.pathname.startsWith(c.to));
  const Icon = item.icon;

  if ("children" in item && item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
            isActive
              ? "bg-sidebar-primary/15 text-sidebar-primary"
              : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          )}
        >
          <Icon className="h-[18px] w-[18px] flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="h-3.5 w-3.5 opacity-40" />
              </motion.div>
            </>
          )}
        </button>
        <AnimatePresence>
          {open && !collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="ml-7 mt-1 space-y-0.5 border-l-2 border-sidebar-border/50 pl-3 overflow-hidden"
            >
              {item.children.map((child) => (
                <Link
                  key={child.to}
                  to={child.to}
                  className={cn(
                    "block px-3 py-2 rounded-lg text-sm transition-all duration-200",
                    location.pathname === child.to
                      ? "text-sidebar-primary font-semibold bg-sidebar-primary/8"
                      : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  {child.label}
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const to = "to" in item ? item.to! : "/admin";

  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-sidebar-primary/15 text-sidebar-primary"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      <Icon className="h-[18px] w-[18px] flex-shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

interface AdminSidebarProps {
  collapsed: boolean;
}

export function AdminSidebar({ collapsed }: AdminSidebarProps) {
  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 272 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="bg-sidebar flex flex-col flex-shrink-0 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-sidebar-primary/5 to-transparent pointer-events-none" />

      <div className="relative p-4 flex items-center gap-3 h-16">
        {collapsed ? (
          <div className="h-9 w-9 rounded-xl gradient-hero flex items-center justify-center flex-shrink-0 shadow-lg">
            <span className="text-sm font-black text-primary-foreground">R</span>
          </div>
        ) : (
          <motion.img
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            src={logoAsset.url}
            alt="ReviewHunts"
            className="h-8 w-auto object-contain brightness-0 invert"
          />
        )}
      </div>

      <div className="h-px bg-sidebar-border/30 mx-4" />

      <nav className="relative flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {sidebarItems.map((item) => (
          <SidebarItem key={item.label} item={item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="relative p-3 space-y-1">
        <div className="h-px bg-sidebar-border/30 mb-2" />
        <Link to="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all duration-200">
          <LogOut className="h-[18px] w-[18px]" />
          {!collapsed && <span>Back to Site</span>}
        </Link>
      </div>
    </motion.aside>
  );
}
