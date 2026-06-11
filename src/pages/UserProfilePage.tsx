import { useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { StarRating } from "@/components/StarRating";
import { BadgeIcon } from "@/components/BadgeDisplay";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { User, MessageSquare, ThumbsUp, Calendar, Award, Users } from "lucide-react";
import { FollowButton } from "@/components/FollowButton";
import { useFollow } from "@/hooks/useFollow";
import { isUuid } from "@/lib/identifier";

export default function UserProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", id],
    queryFn: async () => {
      // Slug-first lookup with UUID fallback so old /user/<uuid> links keep working.
      const column = isUuid(id) ? "user_id" : "username";
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, username, name, avatar_url, bio, job_title, company, industry, is_verified_reviewer, review_count, helpful_votes_received, created_at, total_points, display_title, verification_type, verified_domain, verified_at, linkedin_verified")
        .eq(column, id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Redirect UUID URL to canonical /user/{username} for SEO.
  useEffect(() => {
    if (profile && isUuid(id) && (profile as any).username) {
      navigate(`/user/${(profile as any).username}`, { replace: true });
    }
  }, [profile, id, navigate]);


  // Derived from the resolved profile so queries always key on the real user_id
  // even when the route param is a username slug.
  const resolvedUserId = (profile as any)?.user_id as string | undefined;

  const { data: badges = [] } = useQuery({
    queryKey: ["user-badges-profile", resolvedUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_badges")
        .select("*, badges(*)")
        .eq("user_id", resolvedUserId!);
      return data || [];
    },
    enabled: !!resolvedUserId,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["user-reviews-profile", resolvedUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("*, products!reviews_product_id_fkey(name, slug, logo_url)")
        .eq("user_id", resolvedUserId!)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!resolvedUserId,
  });

  const { followerCount, followingCount } = useFollow(resolvedUserId || "");

  if (isLoading) {
    return (
      <div className="container py-20 text-center text-muted-foreground">Loading profile...</div>
    );
  }

  if (!profile) {
    return (
      <div className="container py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">User Not Found</h1>
        <p className="text-muted-foreground">This profile doesn't exist or is not available.</p>
      </div>
    );
  }


  const stats = [
    { icon: MessageSquare, label: "Reviews", value: profile.review_count || 0 },
    { icon: ThumbsUp, label: "Helpful Votes", value: profile.helpful_votes_received || 0 },
    { icon: Users, label: "Followers", value: followerCount },
    { icon: Award, label: "Following", value: followingCount },
  ];

  return (
    <>
      <SeoHead title={`${profile.name || "User"} - Profile`} description={`View ${profile.name}'s reviews, badges, and contributions.`} />
      <div className="container py-10 max-w-4xl">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 mb-8"
        >
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.name || ""} className="h-full w-full rounded-2xl object-cover" />
              ) : (
                <User className="h-8 w-8 text-primary" />
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                <h1 className="text-2xl font-display font-bold text-foreground">{profile.name || "Anonymous"}</h1>
                {profile.is_verified_reviewer && (
                  <span className="text-[10px] font-semibold text-[hsl(var(--success))] bg-[hsl(var(--success)/0.08)] px-2 py-0.5 rounded-full">Verified</span>
                )}
                <FollowButton targetUserId={id!} />
              </div>
              {(profile.job_title || profile.company) && (
                <p className="text-sm text-muted-foreground mb-2">
                  {profile.job_title}{profile.job_title && profile.company ? " at " : ""}{profile.company}
                </p>
              )}
              {profile.bio && <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">{profile.bio}</p>}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
            {stats.map(({ icon: Icon, label, value }) => (
              <div key={label} className="text-center p-4 rounded-xl bg-muted/40">
                <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-2" />
                <p className="text-xl font-display font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Badges Section */}
        {badges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-6 mb-8"
          >
            <h2 className="text-lg font-display font-bold text-foreground mb-4">Badges</h2>
            <div className="flex flex-wrap gap-4">
              {badges.map((ub: any) => (
                <div key={ub.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/40">
                  <BadgeIcon badge={ub.badges} size="md" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{ub.badges.name}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{ub.badges.tier} tier</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Review History */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <h2 className="text-lg font-display font-bold text-foreground">Reviews ({reviews.length})</h2>
          {reviews.length === 0 ? (
            <div className="glass-card p-12 text-center text-muted-foreground">No reviews yet</div>
          ) : (
            reviews.map((review: any) => (
              <div key={review.id} className="glass-card p-5">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {review.products?.logo_url ? (
                      <img src={review.products.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-primary">{review.products?.name?.charAt(0) || "?"}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link to={`/product/${review.products?.slug}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                        {review.products?.name || "Unknown Product"}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <StarRating rating={review.overall_rating} size="sm" />
                      <span className="text-sm font-bold">{review.overall_rating}.0</span>
                    </div>
                    {review.title && <p className="text-sm font-medium text-foreground mb-1">{review.title}</p>}
                    {review.pros && (
                      <p className="text-sm text-muted-foreground mb-1">
                        <span className="text-[hsl(var(--success))] font-semibold text-xs">PROS: </span>{review.pros}
                      </p>
                    )}
                    {review.cons && (
                      <p className="text-sm text-muted-foreground mb-1">
                        <span className="text-destructive font-semibold text-xs">CONS: </span>{review.cons}
                      </p>
                    )}
                    {review.body && <p className="text-sm text-muted-foreground line-clamp-3">{review.body}</p>}
                  </div>
                </div>
              </div>
            ))
          )}
        </motion.div>
      </div>
    </>
  );
}
