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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Link
        to={`/category/${slug}`}
        className="glass-card group flex items-center gap-4 p-5 hover:shadow-md transition-all duration-300"
      >
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 group-hover:scale-105 transition-all duration-300">
          <IconComponent className="h-5 w-5 text-primary" />
        </div>
        <h3 className="font-bold text-foreground text-[15px] tracking-tight group-hover:text-primary transition-colors truncate">{name}</h3>
      </Link>
    </motion.div>
  );
}
