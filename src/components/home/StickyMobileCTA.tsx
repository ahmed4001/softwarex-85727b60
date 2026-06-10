import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function StickyMobileCTA() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 600);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="md:hidden fixed bottom-3 left-3 right-3 z-50"
        >
          <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-background/95 backdrop-blur shadow-xl shadow-primary/10 p-2 pl-3">
            <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
            <Link
              to="/categories"
              className="flex-1 text-sm font-semibold text-foreground truncate"
            >
              Find your perfect software
            </Link>
            <Link
              to="/categories"
              className="inline-flex items-center gap-1 rounded-xl bg-primary text-primary-foreground text-xs font-semibold px-3 py-2"
            >
              Start <ArrowRight className="h-3 w-3" />
            </Link>
            <button
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
              className="p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
