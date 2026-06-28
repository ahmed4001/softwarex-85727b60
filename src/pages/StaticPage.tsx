import { enhanceHtmlImages } from "@/lib/html-enhance";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";

export default function StaticPage() {
  const { slug } = useParams();

  const { data: page, isLoading } = useQuery({
    queryKey: ["static-page", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("pages")
        .select("*")
        .eq("slug", slug!)
        .eq("is_active", true)
        .single();
      return data;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="container max-w-3xl py-12 space-y-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="container max-w-3xl py-20 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
          <FileText className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Page not found</h1>
        <p className="text-muted-foreground">The page you're looking for doesn't exist or has been removed.</p>
      </div>
    );
  }

  return (
    <>
      <SeoHead
        title={page.seo_title || page.title}
        description={page.seo_description || `${page.title} page`}
      />

      {/* Hero banner */}
      <div className="bg-gradient-to-b from-primary/5 via-primary/[0.02] to-transparent border-b border-border/50">
        <div className="container max-w-3xl py-12 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 tracking-wide uppercase">
              <FileText className="h-3 w-3" />
              {page.title}
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground leading-tight">
              {page.title}
            </h1>
          </motion.div>
        </div>
      </div>

      {/* Body content */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="container max-w-3xl py-10 md:py-14"
      >
        {page.body && (
          <div
            className="static-page-content"
            dangerouslySetInnerHTML={{ __html: enhanceHtmlImages(page.body, page.title || "") }}
          />
        )}
      </motion.div>
    </>
  );
}
