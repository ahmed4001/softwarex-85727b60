import { useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { BarChart3, Package, MessageSquare, ShieldCheck, ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const vendorNav = [
  { to: "/vendor", label: "Dashboard", icon: BarChart3, end: true },
  { to: "/vendor/products", label: "Products", icon: Package },
  { to: "/vendor/reviews", label: "Reviews", icon: MessageSquare },
  { to: "/vendor/claim", label: "Claim Product", icon: ShieldCheck },
];

export function VendorLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
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
          <nav className="flex items-center gap-1">
            {vendorNav.map((n) => {
              const isActive = n.end
                ? location.pathname === n.to
                : location.pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                    isActive ? "text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <n.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{n.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="container py-8 max-w-6xl">
        <Outlet />
      </main>
    </div>
  );
}
