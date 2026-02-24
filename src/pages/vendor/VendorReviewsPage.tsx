import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StarRating } from "@/components/StarRating";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { MessageSquare, Send, Loader2, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function VendorReviewsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get claimed product IDs
  const { data: claims = [] } = useQuery({
    queryKey: ["vendor-claims-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("product_claims")
        .select("product_id, products(name)")
        .eq("user_id", user!.id)
        .eq("status", "approved");
      return data || [];
    },
  });

  const productIds = claims.map((c: any) => c.product_id);

  // Get reviews for those products
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["vendor-reviews", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("*, profiles!reviews_user_id_fkey(name), products!reviews_product_id_fkey(name)")
        .in("product_id", productIds)
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Get existing responses
  const { data: existingResponses = [] } = useQuery({
    queryKey: ["vendor-responses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_responses")
        .select("*")
        .eq("user_id", user!.id);
      return data || [];
    },
  });

  const responseMap = new Map(existingResponses.map((r: any) => [r.review_id, r]));

  if (productIds.length === 0) {
    return (
      <>
        <SeoHead title="Reviews — Vendor Portal" description="Respond to customer reviews." />
        <div className="glass-card p-12 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No claimed products</h2>
          <p className="text-sm text-muted-foreground">Claim a product first to respond to its reviews.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <SeoHead title="Reviews — Vendor Portal" description="Respond to customer reviews." />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-foreground">Customer Reviews</h1>
          <p className="text-muted-foreground mt-1">{reviews.length} review{reviews.length !== 1 ? "s" : ""} across your products</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted/50 animate-pulse" />)}</div>
        ) : reviews.length === 0 ? (
          <div className="glass-card p-12 text-center text-muted-foreground">No reviews yet</div>
        ) : (
          <div className="space-y-4">
            {reviews.map((r: any) => (
              <ReviewResponseCard
                key={r.id}
                review={r}
                existingResponse={responseMap.get(r.id)}
                userId={user!.id}
                onResponded={() => queryClient.invalidateQueries({ queryKey: ["vendor-responses"] })}
              />
            ))}
          </div>
        )}
      </motion.div>
    </>
  );
}

function ReviewResponseCard({ review, existingResponse, userId, onResponded }: {
  review: any;
  existingResponse?: any;
  userId: string;
  onResponded: () => void;
}) {
  const [responseText, setResponseText] = useState("");
  const [showInput, setShowInput] = useState(false);

  const respond = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vendor_responses").insert({
        review_id: review.id,
        user_id: userId,
        body: responseText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Response posted!");
      setResponseText("");
      setShowInput(false);
      onResponded();
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{review.products?.name}</p>
          <StarRating rating={review.overall_rating} size="sm" />
          {review.title && <h4 className="font-semibold text-foreground mt-1">{review.title}</h4>}
        </div>
        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}</span>
      </div>

      {review.body && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{review.body}</p>}

      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{review.profiles?.name || "Anonymous"}</span>
        {review.reviewer_role && <span>· {review.reviewer_role}</span>}
      </div>

      {/* Existing response */}
      {existingResponse ? (
        <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/10">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
            <CheckCircle className="h-3 w-3" /> Vendor Response
          </div>
          <p className="text-sm text-foreground leading-relaxed">{existingResponse.body}</p>
          <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(existingResponse.created_at), { addSuffix: true })}</span>
        </div>
      ) : (
        <div className="mt-3">
          {!showInput ? (
            <Button variant="outline" size="sm" onClick={() => setShowInput(true)} className="gap-1.5 text-xs">
              <MessageSquare className="h-3.5 w-3.5" /> Respond
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Write your response..."
                className="text-sm"
                onKeyDown={(e) => e.key === "Enter" && responseText.trim() && respond.mutate()}
              />
              <Button size="sm" onClick={() => respond.mutate()} disabled={respond.isPending || !responseText.trim()} className="gap-1 px-3">
                {respond.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
