import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function NewsletterSection() {
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const { error } = await supabase.from("newsletter_subscribers").insert({ email: email.trim() });
    if (error) {
      if (error.code === "23505") toast.info("You're already subscribed!");
      else toast.error("Failed to subscribe.");
    } else {
      toast.success("Welcome aboard!");
      setEmail("");
    }
  };

  return (
    <section className="py-28 relative">
      <div className="container max-w-3xl text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="h-20 w-20 rounded-3xl gradient-hero flex items-center justify-center mx-auto mb-8 animate-pulse-glow shadow-2xl">
            <TrendingUp className="h-9 w-9 text-primary-foreground" />
          </div>
          <h2 className="text-3xl md:text-5xl font-display font-black text-foreground mb-4">
            Stay Ahead of the Curve
          </h2>
          <p className="text-muted-foreground mb-10 text-lg max-w-md mx-auto">
            Get the latest software reviews and industry insights delivered weekly.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@company.com"
              className="h-14 rounded-2xl bg-card text-base flex-1 border-border/50 px-5"
              required
            />
            <Button
              type="submit"
              className="btn-premium h-14 px-8 rounded-2xl text-primary-foreground font-semibold gap-2 text-base"
            >
              Subscribe <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-xs text-muted-foreground/60 mt-5">
            No spam, ever. Unsubscribe anytime.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
