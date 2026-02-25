import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="py-20 md:py-24" aria-labelledby="cta-heading">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl bg-foreground p-12 md:p-16 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-[0.03]" aria-hidden="true" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />

          <div className="relative z-10">
            <h2 id="cta-heading" className="text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight">
              Ready to Find the Best
              <br />
              Software for Your Business?
            </h2>
            <p className="text-white/40 text-lg mb-8 max-w-lg mx-auto">
              Join thousands of professionals using SoftwareHub to compare tools, read verified reviews, and make smarter software purchasing decisions — completely free.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/categories">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-8 rounded-xl font-semibold gap-2">
                  Start Comparing Software <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/categories">
                <Button size="lg" variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10 h-12 px-8 rounded-xl font-semibold">
                  Browse All Categories
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
