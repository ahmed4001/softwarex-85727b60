import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { motion } from "framer-motion";

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

  if (isLoading) return <div className="container py-20 text-center text-muted-foreground">Loading...</div>;
  if (!page) return <div className="container py-20 text-center text-muted-foreground">Page not found.</div>;

  return (
    <>
      <SeoHead
        title={page.seo_title || page.title}
        description={page.seo_description || `${page.title} page`}
      />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="container max-w-3xl py-12"
      >
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-8">{page.title}</h1>
        {page.body && (
          <div
            className="prose prose-sm max-w-none text-muted-foreground leading-relaxed [&_h2]:text-foreground [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-xl [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-foreground [&_h3]:font-semibold [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
            dangerouslySetInnerHTML={{ __html: page.body }}
          />
        )}
      </motion.div>
    </>
  );
}
