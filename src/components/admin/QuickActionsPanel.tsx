import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Plus, Upload, Send, FileText, ShieldCheck,
  Sparkles, BarChart3, Settings, Image
} from "lucide-react";
import { motion } from "framer-motion";

const actions = [
  { icon: Plus, label: "New Product", to: "/admin/products/new", color: "bg-primary/10 text-primary" },
  { icon: FileText, label: "New Post", to: "/admin/blog/new", color: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" },
  { icon: ShieldCheck, label: "Moderate", to: "/admin/reviews/pending", color: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]" },
  { icon: Upload, label: "Import", to: "/admin/import-export", color: "bg-[hsl(var(--info))]/10 text-[hsl(var(--info))]" },
  { icon: Send, label: "Broadcast", to: "/admin/broadcast", color: "bg-primary/10 text-primary" },
  { icon: Sparkles, label: "AI Tools", to: "/admin/ai", color: "bg-[hsl(var(--star))]/10 text-[hsl(var(--star))]" },
  { icon: Image, label: "Media", to: "/admin/media", color: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" },
  { icon: Settings, label: "Settings", to: "/admin/settings", color: "bg-muted text-muted-foreground" },
];

export function QuickActionsPanel() {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <h3 className="text-sm font-bold text-foreground mb-3">Quick Actions</h3>
        <div className="grid grid-cols-4 gap-2">
          {actions.map((action, i) => (
            <motion.div
              key={action.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link to={action.to}>
                <Button
                  variant="ghost"
                  className="h-auto w-full flex-col gap-1.5 py-3 px-2 rounded-xl hover:bg-muted/50"
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${action.color}`}>
                    <action.icon className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-medium text-foreground">{action.label}</span>
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
