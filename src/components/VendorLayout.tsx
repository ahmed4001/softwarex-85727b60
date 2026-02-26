import { Outlet, Link, useLocation } from "react-router-dom";
import { RequireAuth } from "@/components/RequireAuth";
import { BarChart3, Package, MessageSquare, ShieldCheck, ArrowLeft, TrendingUp, FileText, Users, CreditCard, UserPlus, Megaphone, PieChart, Swords, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const vendorNav = [
  { to: "/vendor", label: "Dashboard", icon: BarChart3, end: true },
  { to: "/vendor/products", label: "Products", icon: Package },
  { to: "/vendor/reviews", label: "Reviews", icon: MessageSquare },
  { to: "/vendor/leads", label: "Leads", icon: UserPlus },
  { to: "/vendor/analytics", label: "Analytics", icon: TrendingUp },
  { to: "/vendor/roi", label: "ROI", icon: PieChart },
  { to: "/vendor/sponsored", label: "Sponsored", icon: Megaphone },
  { to: "/vendor/plans", label: "Plans", icon: CreditCard },
  { to: "/vendor/templates", label: "Templates", icon: FileText },
  { to: "/vendor/competitors", label: "Competitors", icon: Users },
  { to: "/vendor/war-room", label: "War Room", icon: Swords },
  { to: "/vendor/claim", label: "Claim", icon: ShieldCheck },
];

export function VendorLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md">
          <div className="container flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-xs font-bold text-primary-foreground">V</span>
                </div>
                <span className="text-sm font-bold text-foreground">Vendor Portal</span>
              </div>
            </div>
            {/* Desktop nav - horizontal scroll */}
            <ScrollArea className="hidden md:block max-w-[60vw]">
              <nav className="flex items-center gap-1 py-1">
                {vendorNav.map((n) => {
                  const isActive = n.end
                    ? location.pathname === n.to
                    : location.pathname.startsWith(n.to);
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap",
                        isActive ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <n.icon className="h-4 w-4" />
                      {n.label}
                    </Link>
                  );
                })}
              </nav>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            {/* Mobile toggle */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
          {/* Mobile nav */}
          {mobileOpen && (
            <div className="md:hidden border-t border-border bg-card p-3 grid grid-cols-3 gap-1">
              {vendorNav.map((n) => {
                const isActive = n.end
                  ? location.pathname === n.to
                  : location.pathname.startsWith(n.to);
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1 px-2 py-2.5 text-xs font-medium rounded-lg transition-colors",
                      isActive ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <n.icon className="h-4 w-4" />
                    {n.label}
                  </Link>
                );
              })}
            </div>
          )}
        </header>

        <main className="container py-6 md:py-8 max-w-6xl">
          <Outlet />
        </main>
      </div>
    </RequireAuth>
  );
}
