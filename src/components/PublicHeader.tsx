import { Link, useLocation } from "react-router-dom";
import logoAsset from "@/assets/reviewhunts-logo.png.asset.json";
import { SearchBar } from "./SearchBar";
import { Button } from "@/components/ui/button";
import { Menu, X, LayoutDashboard, Store, ChevronDown, BookOpen, BarChart3, GitCompareArrows, Trophy, Activity, DollarSign, MessageCircle, Layers, Compass, BookMarked } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NotificationBell } from "./NotificationBell";

const resourceLinks = [
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

  const navLinks = [
    { to: "/", label: t("nav.home") },
    { to: "/categories", label: t("nav.categories") },
    { to: "/compare", label: t("nav.compare") },
    { to: "/compare-pricing", label: t("nav.comparePricing", "Compare Pricing") },
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
        ? "bg-card/95 backdrop-blur-md border-b border-border shadow-sm"
        : "bg-transparent border-b border-transparent"
    )}>
      <div className="container flex items-center justify-between h-16 gap-4">
        <Link to="/" className="flex items-center flex-shrink-0" aria-label="ReviewHunts">
          <img src={logoAsset.url} alt="ReviewHunts" className="h-14 md:h-16 w-auto" />
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                location.pathname === l.to
                  ? "text-primary bg-primary/8"
                  : "text-muted-foreground hover:text-foreground"
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
                "flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                isResourceActive
                  ? "text-primary bg-primary/8"
                  : "text-muted-foreground hover:text-foreground"
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

        <div className="hidden lg:block flex-1 max-w-sm">
          <SearchBar variant="compact" />
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <NotificationBell />
          {user ? (
            <div className="flex items-center gap-1">
              <Link to="/vendor">
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex font-medium text-sm gap-1.5">
                  <Store className="h-4 w-4" /> {t("nav.vendor")}
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex font-medium text-sm gap-1.5">
                  <LayoutDashboard className="h-4 w-4" /> {t("nav.dashboard")}
                </Button>
              </Link>
            </div>
          ) : (
            <Link to="/login">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex font-medium text-sm">
                {t("nav.signIn")}
              </Button>
            </Link>
          )}
          <Link to="/submit-product">
            <Button size="sm" className="bg-primary text-primary-foreground rounded-lg font-semibold px-4 text-sm">
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