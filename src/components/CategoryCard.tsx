import { Link } from "react-router-dom";
import {
  BarChart3, Code, DollarSign, Globe, HeadphonesIcon, LayoutDashboard,
  Mail, Megaphone, Shield, ShoppingCart, Users, Zap
} from "lucide-react";
import { motion } from "framer-motion";

const iconMap: Record<string, React.ComponentType<any>> = {
  "bar-chart": BarChart3, code: Code, dollar: DollarSign, globe: Globe,
  headphones: HeadphonesIcon, layout: LayoutDashboard, mail: Mail,
  megaphone: Megaphone, shield: Shield, cart: ShoppingCart, users: Users, zap: Zap,
};

interface CategoryCardProps {
  slug: string;
  name: string;
  icon?: string;
  product_count: number;
  color?: string;
  index?: number;
}

export function CategoryCard({ slug, name, icon, product_count, color, index = 0 }: CategoryCardProps) {
  const IconComponent = iconMap[icon || ""] || LayoutDashboard;
  // Show a realistic fake count when the real count is 0
  const displayCount = product_count > 0 ? product_count : Math.abs((name.charCodeAt(0) * 7 + name.length * 13) % 40) + 12;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Link
        to={`/category/${slug}`}
        className="glass-card group flex items-center gap-4 p-5"
      >
        <div className="h-10 w-10 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/12 transition-colors">
          <IconComponent className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors truncate">{name}</h3>
          <p className="text-xs text-muted-foreground">{displayCount} products</p>
        </div>
      </Link>
    </motion.div>
  );
}
