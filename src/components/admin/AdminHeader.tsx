import { Search, PanelLeftClose, PanelLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NotificationBell } from "@/components/NotificationBell";

interface AdminHeaderProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function AdminHeader({ collapsed, onToggleCollapse }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-2xl border-b border-border/50 h-16 flex items-center px-6 gap-4">
      <button
        onClick={onToggleCollapse}
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
        <NotificationBell />
        <div className="h-9 w-9 rounded-xl gradient-hero flex items-center justify-center shadow-sm">
          <span className="text-xs font-bold text-primary-foreground">A</span>
        </div>
      </div>
    </header>
  );
}
