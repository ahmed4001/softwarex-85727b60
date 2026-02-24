import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  BarChart3, Box, ChevronDown, ChevronRight, FileText, FolderOpen,
  Image, LayoutDashboard, LogOut, Megaphone, MessageSquare, Settings,
  Star, Users, Bell, Search, Menu, Activity, Mail, PanelLeftClose, PanelLeft, Database, Sparkles
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

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
      { label: "Pages", to: "/admin/pages" },
    ]
  },
  { label: "Media Library", icon: Image, to: "/admin/media" },
  { label: "Advertisements", icon: Megaphone, to: "/admin/ads" },
  { label: "Submissions", icon: MessageSquare, to: "/admin/submissions" },
  { label: "Email Templates", icon: Mail, to: "/admin/emails" },
  { label: "Analytics", icon: BarChart3, to: "/admin/analytics" },
  { label: "Settings", icon: Settings, to: "/admin/settings" },
  { label: "Activity Log", icon: Activity, to: "/admin/activity" },
  { label: "Seed Data", icon: Database, to: "/admin/seed" },
  { label: "AI Import", icon: Sparkles, to: "/admin/ai-import" },
];

function SidebarItem({ item, collapsed }: { item: any; collapsed: boolean }) {
  const location = useLocation();
  const [open, setOpen] = useState(() => {
    if (item.children) return item.children.some((c: any) => location.pathname.startsWith(c.to));
    return false;
  });
  const isActive = item.to ? location.pathname === item.to : item.children?.some((c: any) => location.pathname.startsWith(c.to));
  const Icon = item.icon;

  if (item.children) {
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
              {item.children.map((child: any) => (
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

  return (
    <Link
      to={item.to}
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

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 272 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="bg-sidebar flex flex-col flex-shrink-0 relative overflow-hidden"
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-sidebar-primary/5 to-transparent pointer-events-none" />
        
        <div className="relative p-4 flex items-center gap-3 h-16">
          <div className="h-9 w-9 rounded-xl gradient-hero flex items-center justify-center flex-shrink-0 shadow-lg">
            <span className="text-sm font-black text-primary-foreground">S</span>
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-display font-bold text-sidebar-foreground whitespace-nowrap"
            >
              SoftwareHub
            </motion.span>
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

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-2xl border-b border-border/50 h-16 flex items-center px-6 gap-4">
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
          >
            {collapsed ? <PanelLeft className="h-5 w-5 text-muted-foreground" /> : <PanelLeftClose className="h-5 w-5 text-muted-foreground" />}
          </button>
          <div className="flex-1 max-w-lg">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search anything..." className="pl-10 h-10 bg-muted/50 border-0 rounded-xl" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative rounded-xl">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute -top-0.5 -right-0.5 h-4.5 w-4.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-card">3</span>
            </Button>
            <div className="h-9 w-9 rounded-xl gradient-hero flex items-center justify-center shadow-sm">
              <span className="text-xs font-bold text-primary-foreground">A</span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
