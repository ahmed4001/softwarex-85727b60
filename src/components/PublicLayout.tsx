import { Outlet, useLocation } from "react-router-dom";
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";
import { ScrollToTop } from "./ScrollToTop";
import { motion, AnimatePresence } from "framer-motion";

export function PublicLayout() {
  const location = useLocation();
  const hideFooterRoutes = ["/login", "/submit-product", "/checkout", "/choose-plan"];
  const hideFooter = hideFooterRoutes.some((p) => location.pathname === p || location.pathname.startsWith(p + "/"));

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      {!isLoginPage && <PublicFooter />}
      <ScrollToTop />
    </div>
  );
}

