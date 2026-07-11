import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { Award, TrendingUp, CheckCircle } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import softwareCollage from "@/assets/bestsoftware.webp";
import softwareCollage800 from "@/assets/bestsoftware-800.webp";
import softwareCollage480 from "@/assets/bestsoftware-480.webp";
import softwareCollageJpg from "@/assets/bestsoftware.jpg";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";

export function HeroSection() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  return (
    <section className="relative overflow-hidden" style={{ background: "hsl(15 60% 96%)" }} aria-label={t("hero.searchPlaceholder")}>
      {/* Preload the LCP hero image with responsive srcset so the browser starts fetching immediately */}
      <Helmet>
        <link
          rel="preload"
          as="image"
          href={softwareCollage480}
          // @ts-expect-error - imagesrcset / imagesizes are valid HTML but not yet in React's types
          imagesrcset={`${softwareCollage480} 480w, ${softwareCollage800} 800w, ${softwareCollage} 1024w`}
          imagesizes="(max-width: 640px) 100vw, (max-width: 1024px) 800px, 1024px"
          fetchpriority="high"
          type="image/webp"
        />
      </Helmet>
      {/* Geometric shapes - desktop only, not mounted on mobile for performance */}
      {!isMobile && (
        <>
      <motion.div
        className="hidden md:block absolute top-[-60px] left-[-40px] w-48 h-48 rounded-2xl"
        style={{ background: "hsl(220 90% 56%)" }}
        animate={{ rotate: [12, 20, 5, 12], y: [0, -15, 10, 0], x: [0, 10, -5, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      />
      <motion.div
        className="hidden md:block absolute top-[-30px] left-[60px] w-36 h-36 rounded-2xl"
        style={{ background: "hsl(0 80% 60%)" }}
        animate={{ rotate: [-6, 8, -12, -6], y: [0, 12, -8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        aria-hidden="true"
      />
      <motion.div
        className="hidden md:block absolute top-[-50px] right-[-30px] w-44 h-44 rounded-2xl"
        style={{ background: "hsl(165 80% 48%)" }}
        animate={{ rotate: [20, 30, 15, 20], y: [0, -10, 15, 0], x: [0, -12, 5, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        aria-hidden="true"
      />
      <motion.div
        className="hidden md:block absolute bottom-[-40px] left-[5%] w-40 h-40 rounded-2xl"
        style={{ background: "hsl(0 80% 58%)" }}
        animate={{ rotate: [-12, -5, -18, -12], y: [0, 10, -12, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        aria-hidden="true"
      />
      <motion.div
        className="hidden md:block absolute bottom-[-50px] right-[8%] w-52 h-52 rounded-full"
        style={{ background: "hsl(260 60% 45%)" }}
        animate={{ rotate: [6, 15, -3, 6], scale: [1, 1.05, 0.97, 1] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
        aria-hidden="true"
      />
        </>
      )}
      {/* Subtle mobile-only accents */}
      <div
        className="md:hidden absolute -top-16 -right-12 w-44 h-44 rounded-full opacity-60"
        style={{ background: "radial-gradient(circle, hsl(190 75% 60% / 0.35), transparent 70%)" }}
        aria-hidden="true"
      />
      <div
        className="md:hidden absolute -bottom-20 -left-12 w-52 h-52 rounded-full opacity-60"
        style={{ background: "radial-gradient(circle, hsl(260 60% 60% / 0.3), transparent 70%)" }}
        aria-hidden="true"
      />
      {/* Extra desktop-only 3D-style shapes */}
      {!isMobile && (
        <>
      <motion.div
        className="hidden lg:block absolute top-[30%] left-[-25px] w-28 h-28 rounded-full"
        style={{ background: "linear-gradient(135deg, hsl(280 70% 55%), hsl(320 70% 50%))" }}
        animate={{ y: [0, -20, 10, 0], scale: [1, 1.08, 0.95, 1], rotate: [0, 10, -5, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        aria-hidden="true"
      />
      <motion.div
        className="hidden lg:block absolute top-[15%] right-[15%] w-20 h-20 rounded-xl"
        style={{ background: "linear-gradient(145deg, hsl(40 90% 55%), hsl(25 85% 50%))" }}
        animate={{ rotate: [0, 25, -10, 0], y: [0, -18, 12, 0], x: [0, 8, -6, 0] }}
        transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        aria-hidden="true"
      />
      <motion.div
        className="hidden lg:block absolute bottom-[30%] left-[12%] w-16 h-16 rounded-full"
        style={{ background: "linear-gradient(180deg, hsl(190 80% 50%), hsl(210 85% 55%))" }}
        animate={{ scale: [1, 1.15, 0.9, 1], y: [0, 15, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        aria-hidden="true"
      />
      <motion.div
        className="hidden lg:block absolute top-[40%] right-[-15px] w-24 h-24 rounded-2xl"
        style={{ background: "linear-gradient(160deg, hsl(350 75% 55%), hsl(10 80% 50%))" }}
        animate={{ rotate: [-15, 10, -20, -15], x: [0, -10, 8, 0], scale: [1, 1.06, 0.94, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
        aria-hidden="true"
      />
      <motion.div
        className="hidden lg:block absolute bottom-[10%] left-[40%] w-14 h-14 rounded-full"
        style={{ background: "linear-gradient(135deg, hsl(140 70% 45%), hsl(165 75% 50%))" }}
        animate={{ y: [0, -12, 8, 0], x: [0, 10, -6, 0], rotate: [0, 15, -8, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1.8 }}
        aria-hidden="true"
      />
      <motion.div
        className="hidden lg:block absolute top-[60%] left-[25%] w-10 h-10 rounded-lg"
        style={{ background: "linear-gradient(120deg, hsl(50 85% 55%), hsl(35 80% 50%))" }}
        animate={{ rotate: [0, 30, -15, 0], scale: [1, 1.2, 0.85, 1] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
        aria-hidden="true"
      />
      <motion.div
        className="hidden md:block absolute bottom-[20px] right-[-20px] w-36 h-36 rounded-2xl"
        style={{ background: "hsl(165 80% 48%)" }}
        animate={{ rotate: [30, 40, 22, 30], y: [0, -14, 8, 0], x: [0, -8, 6, 0] }}
        transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
        aria-hidden="true"
      />
        </>
      )}

      <div className="container relative z-10 py-14 sm:py-20 md:py-32 lg:py-40 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-[2rem] leading-[1.1] sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-foreground sm:leading-[1.08] mb-4 sm:mb-6 tracking-tight">
            {t("hero.title1")}
            <br />
            <motion.span
              className="text-primary inline-block"
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6, type: "spring", stiffness: 120 }}
            >
              <motion.span
                className="inline-block"
                animate={{ 
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  backgroundImage: "linear-gradient(90deg, hsl(var(--primary)), hsl(260 60% 55%), hsl(330 80% 55%), hsl(var(--primary)))",
                  backgroundSize: "200% auto",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {t("hero.title2")}
              </motion.span>
            </motion.span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-foreground/60 mb-3 sm:mb-4 max-w-2xl mx-auto leading-relaxed px-2"
            dangerouslySetInnerHTML={{ __html: t("hero.subtitle") }}
          />
          <p className="text-xs sm:text-sm text-foreground/40 mb-6 sm:mb-10 max-w-xl mx-auto flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
            <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-primary" /> {t("hero.verifiedReviews")}</span>
            <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-primary" /> {t("hero.categories")}</span>
            <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-primary" /> {t("hero.free")}</span>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="max-w-2xl mx-auto mb-6 sm:mb-8 px-1"
        >
          <label htmlFor="hero-search" className="sr-only">{t("hero.searchPlaceholder")}</label>
          <SearchBar variant="hero" className="w-full" />
        </motion.div>

        <motion.nav
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm"
          aria-label="Quick links"
        >
          <Link to="/categories" className="flex items-center gap-1.5 text-foreground/50 hover:text-primary transition-colors font-medium">
            <Award className="h-4 w-4" aria-hidden="true" /> {t("hero.bestSoftware")}
          </Link>
          <Link to="/categories" className="flex items-center gap-1.5 text-foreground/50 hover:text-primary transition-colors font-medium">
            <TrendingUp className="h-4 w-4" aria-hidden="true" /> {t("hero.trending")}
          </Link>
        </motion.nav>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-8 sm:mt-12 max-w-5xl mx-auto"
        >
          <div className="rounded-2xl overflow-hidden shadow-xl border border-border/20">
            <picture>
              <source
                type="image/webp"
                srcSet={`${softwareCollage480} 480w, ${softwareCollage800} 800w, ${softwareCollage} 1024w`}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 800px, 1024px"
              />
              <img
                src={softwareCollageJpg}
                alt="Software ecosystem showcasing popular business tools like Salesforce, Slack, Adobe, AWS, and more"
                className="w-full h-auto object-cover"
                width={1024}
                height={559}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </picture>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
