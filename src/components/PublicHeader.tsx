import { Link, useLocation } from "react-router-dom";
import { SearchBar } from "./SearchBar";
import { Button } from "@/components/ui/button";
import { Menu, X, LayoutDashboard, Store } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function PublicHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();

  const navLinks = [
    { to: "/", label: t("nav.home") },
    { to: "/categories", label: t("nav.categories") },
    { to: "/compare", label: t("nav.compare") },
    { to: "/leaderboard", label: t("nav.leaderboard") },
    { to: "/blog", label: t("nav.blog") },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={cn(
      "sticky top-0 z-50 transition-all duration-300",
      scrolled
        ? "bg-card/95 backdrop-blur-md border-b border-border shadow-sm"
        : "bg-transparent border-b border-transparent"
    )}>
      <div className="container flex items-center justify-between h-16 gap-4">
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-sm font-bold text-primary-foreground">S</span>
          </div>
          <span className="text-base font-bold text-foreground hidden sm:block">
            Software<span className="text-primary">Hub</span>
          </span>
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
        </nav>

        <div className="hidden lg:block flex-1 max-w-sm">
          <SearchBar variant="compact" />
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
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
