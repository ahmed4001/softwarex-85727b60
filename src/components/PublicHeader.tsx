import { Link, useLocation } from "react-router-dom";
const logoAsset = { url: "/reviewhunts-logo.png" };
import { SearchBar } from "./SearchBar";
import { Button } from "@/components/ui/button";
import { Menu, X, LayoutDashboard, Store, ChevronDown, BookOpen, BarChart3, GitCompareArrows, Trophy, Activity, DollarSign, MessageCircle, Layers, Compass, BookMarked, Tag } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NotificationBell } from "./NotificationBell";
import { useBrandingSettings } from "@/hooks/useBrandingSettings";

const resourceLinks = [
  { to: "/compare-pricing", label: "nav.comparePricing", icon: Tag },
  { to: "/blog", label: "nav.blog", icon: BookOpen },
  { to: "/leaderboard", label: "nav.leaderboard", icon: Trophy },
  { to: "/activity", label: "nav.activityFeed", icon: Activity },
  { to: "/awards", label: "nav.awards", icon: Trophy },
  { to: "/discussions", label: "Discussions", icon: MessageCircle },
  { to: "/stacks", label: "Tech Stacks", icon: Layers },
  { to: "/guides", label: "Buyer Guides", icon: Compass },
  { to: "/glossary", label: "Glossary", icon: BookMarked },
];

export function PublicHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const resourcesRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();
  const branding = useBrandingSettings();

  const headerMinHeightMobile = Math.max(branding.logoHeightMobile + 16, 56);
  const headerMinHeightDesktop = Math.max(branding.logoHeightDesktop + 20, 64);

  const navLinks = [
    { to: "/", label: t("nav.home") },
    { to: "/categories", label: t("nav.categories") },
    { to: "/compare", label: t("nav.compare") },
    { to: "/deals", label: "Deals" },
  ];

  const isResourceActive = resourceLinks.some((l) => location.pathname.startsWith(l.to));

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (resourcesRef.current && !resourcesRef.current.contains(e.target as Node)) {
        setResourcesOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close dropdown on route change
  useEffect(() => { setResourcesOpen(false); setMobileOpen(false); }, [location.pathname]);

  return (
    <header className={cn(
      "sticky top-0 z-50 transition-all duration-300",
      scrolled
        ? "bg-gradient-to-b from-card/70 to-card/40 backdrop-blur-2xl border-b border-white/15 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
        : "bg-gradient-to-b from-card/30 to-transparent backdrop-blur-md border-b border-white/5"
    )}>
      <div
        className="container flex items-center justify-between gap-4 min-h-[var(--header-h-mobile)] md:min-h-[var(--header-h-desktop)]"
        style={{
          ['--logo-h-mobile' as any]: `${branding.logoHeightMobile}px`,
          ['--logo-h-desktop' as any]: `${branding.logoHeightDesktop}px`,
          ['--logo-mw-mobile' as any]: `${branding.logoMaxWidthMobile}px`,
          ['--logo-mw-desktop' as any]: `${branding.logoMaxWidthDesktop}px`,
          ['--header-h-mobile' as any]: `${headerMinHeightMobile}px`,
          ['--header-h-desktop' as any]: `${headerMinHeightDesktop}px`,
        }}
      >
        <Link to="/" className="flex items-center flex-shrink-0 py-1.5 pl-1" aria-label="ReviewHunts">
          <img
            src={logoAsset.url}
            alt="ReviewHunts"
            className="w-auto object-contain h-[var(--logo-h-mobile)] md:h-[var(--logo-h-desktop)] max-w-[var(--logo-mw-mobile)] md:max-w-[var(--logo-mw-desktop)]"
          />
        </Link>

        <nav className="hidden lg:flex items-center gap-1.5">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "px-3.5 py-2 text-[13px] font-medium rounded-lg transition-colors whitespace-nowrap",
                location.pathname === l.to
                  ? "text-primary bg-primary/8"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {l.label}
            </Link>
          ))}

          {/* Resources dropdown */}
          <div className="relative" ref={resourcesRef}>
            <button
              onClick={() => setResourcesOpen(!resourcesOpen)}
              className={cn(
                "flex items-center gap-1 px-3.5 py-2 text-[13px] font-medium rounded-lg transition-colors whitespace-nowrap",
                isResourceActive
                  ? "text-primary bg-primary/8"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {t("nav.resources", "Resources")}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", resourcesOpen && "rotate-180")} />
            </button>
            {resourcesOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-52 rounded-xl border border-border bg-card shadow-lg p-1.5 animate-in fade-in-0 zoom-in-95">
                {resourceLinks.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg transition-colors",
                      location.pathname.startsWith(l.to)
                        ? "text-primary bg-primary/8 font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    <l.icon className="h-4 w-4" />
                    {t(l.label)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="hidden lg:block w-[180px] xl:w-[220px] flex-shrink-0">
          <SearchBar variant="compact" />
        </div>

        <div className="flex items-center gap-1.5">
          <LanguageSwitcher />
          <NotificationBell />
          {user ? (
            <div className="flex items-center gap-1">
              <Link to="/vendor">
                <Button variant="ghost" size="sm" className="hidden xl:inline-flex font-medium text-[13px] gap-1.5 px-2.5">
                  <Store className="h-4 w-4" /> {t("nav.vendor")}
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="hidden xl:inline-flex font-medium text-[13px] gap-1.5 px-2.5">
                  <LayoutDashboard className="h-4 w-4" /> {t("nav.dashboard")}
                </Button>
              </Link>
            </div>
          ) : (
            <Link to="/login">
              <Button variant="ghost" size="sm" className="hidden md:inline-flex font-medium text-[13px] px-2.5">
                {t("nav.signIn")}
              </Button>
            </Link>
          )}
          <Link to="/submit-product">
            <Button size="sm" className="bg-primary text-primary-foreground rounded-lg font-semibold px-3 text-[13px] whitespace-nowrap">
              {t("nav.submitProduct")}
            </Button>
          </Link>
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-border bg-card">
          <div className="p-4 space-y-1">
            <SearchBar variant="compact" className="mb-3" />
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <div className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("nav.resources", "Resources")}
            </div>
            {resourceLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
              >
                <l.icon className="h-4 w-4" />
                {t(l.label)}
              </Link>
            ))}
            {user ? (
              <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-muted transition-colors">
                {t("nav.dashboard")}
              </Link>
            ) : (
              <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-muted transition-colors">
                {t("nav.signIn")}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}