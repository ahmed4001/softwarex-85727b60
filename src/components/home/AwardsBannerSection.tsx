import { motion } from "framer-motion";
import { Trophy, Medal, Award, Gem } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const awards = [
  { icon: Trophy, label: "Best Overall", desc: "Top-rated software across all categories", color: "text-yellow-500" },
  { icon: Medal, label: "Most Popular", desc: "Highest user engagement this quarter", color: "text-blue-500" },
  { icon: Award, label: "Rising Star", desc: "Fastest growing products by review count", color: "text-green-500" },
  { icon: Gem, label: "Best Value", desc: "Highest satisfaction-to-price ratio", color: "text-purple-500" },
];

export function AwardsBannerSection() {
  return (
    <section className="py-20 bg-muted/30" aria-labelledby="awards-heading">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-sm font-semibold text-primary mb-1">🏆 2026 Awards</p>
          <h2 id="awards-heading" className="text-2xl md:text-3xl font-extrabold text-foreground">
            SoftwareHub Annual Awards
          </h2>
          <p className="text-muted-foreground mt-1 max-w-lg mx-auto">
            Recognizing excellence in software — voted by real users and verified by our team
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {awards.map((a, i) => (
            <motion.div
              key={a.label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="glass-card p-6 text-center group hover:border-primary/30 transition-colors"
            >
              <div className="h-12 w-12 rounded-xl bg-primary/8 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/12 transition-colors">
                <a.icon className={`h-6 w-6 ${a.color}`} />
              </div>
              <h3 className="font-bold text-foreground text-sm mb-1">{a.label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{a.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <Link to="/awards">
            <Button variant="outline" className="font-semibold gap-2">
              <Trophy className="h-4 w-4" /> View All Award Winners
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
