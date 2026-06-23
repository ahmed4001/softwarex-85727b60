import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StarRating } from "@/components/StarRating";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Upload, X, Loader2, ArrowLeft, Camera } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ReviewTemplateSelector } from "@/components/ReviewTemplateSelector";

const CRITERIA = [
  { key: "overall_rating", label: "Overall Rating", required: true },
  { key: "ease_of_use", label: "Ease of Use" },
  { key: "customer_support", label: "Customer Support" },
  { key: "value_for_money", label: "Value for Money" },
  { key: "features_rating", label: "Features & Functionality" },
] as const;

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"];
const USAGE_DURATIONS = ["Less than 6 months", "6-12 months", "1-2 years", "2+ years"];

const PRO_TAG_OPTIONS = ["Easy Setup", "Great UI/UX", "Good Value", "Excellent Support", "Feature Rich", "Fast Performance", "Good Integrations", "Active Development"];
const CON_TAG_OPTIONS = ["Steep Learning Curve", "Expensive", "Limited Features", "Slow Support", "Buggy", "Poor Documentation", "Limited Integrations", "Outdated UI"];

export default function WriteReviewPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: product, isLoading: loadingProduct } = useQuery({
    queryKey: ["product-for-review", slug],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, slug, logo_url").eq("slug", slug!).single();
      return data;
    },
    enabled: !!slug,
  });

  const [ratings, setRatings] = useState<Record<string, number>>({ overall_rating: 0 });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");
  const [reviewerRole, setReviewerRole] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [industry, setIndustry] = useState("");
  const [usageDuration, setUsageDuration] = useState("");
  const [recommendation, setRecommendation] = useState(8);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [prosTags, setProsTags] = useState<string[]>([]);
  const [consTags, setConsTags] = useState<string[]>([]);

  const toggleTag = (tag: string, list: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  };

  const setRating = (key: string, val: number) => setRatings((r) => ({ ...r, [key]: val }));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => f.size <= 5 * 1024 * 1024 && (f.type.startsWith("image/") || f.type.startsWith("video/")));
    if (valid.length < files.length) toast.error("Some files were skipped (max 5MB, images/videos only)");
    const total = [...mediaFiles, ...valid].slice(0, 5);
    setMediaFiles(total);
    setMediaPreviews(total.map((f) => URL.createObjectURL(f)));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeMedia = (i: number) => {
    URL.revokeObjectURL(mediaPreviews[i]);
    setMediaFiles((f) => f.filter((_, idx) => idx !== i));
    setMediaPreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!user || !product) throw new Error("Not authenticated");
      if (!ratings.overall_rating) throw new Error("Overall rating is required");
      if (!title.trim()) throw new Error("Title is required");

      // 1. Insert review
      const { data: review, error } = await supabase.from("reviews").insert({
        product_id: product.id,
        user_id: user.id,
        overall_rating: ratings.overall_rating,
        ease_of_use: ratings.ease_of_use || null,
        customer_support: ratings.customer_support || null,
        value_for_money: ratings.value_for_money || null,
        features_rating: ratings.features_rating || null,
        title: title.trim(),
        body: body.trim() || null,
        pros: pros.trim() || null,
        cons: cons.trim() || null,
        pros_tags: prosTags,
        cons_tags: consTags,
        reviewer_role: reviewerRole.trim() || null,
        company_size: companySize || null,
        industry: industry.trim() || null,
        usage_duration: usageDuration || null,
        recommendation_likelihood: recommendation,
        status: "pending",
        source: "organic",
      }).select("id").single();
      if (error) throw error;

      // 2. Upload media
      if (mediaFiles.length > 0 && review) {
        for (let i = 0; i < mediaFiles.length; i++) {
          const file = mediaFiles[i];
          const ext = file.name.split(".").pop();
          const path = `${user.id}/${review.id}/${i}.${ext}`;
          const { error: uploadErr } = await supabase.storage.from("review-media").upload(path, file);
          if (uploadErr) { console.error("Upload failed:", uploadErr); continue; }
          const { data: urlData } = supabase.storage.from("review-media").getPublicUrl(path);
          await supabase.from("review_media").insert({
            review_id: review.id,
            user_id: user.id,
            url: urlData.publicUrl,
            file_type: file.type,
            file_size: file.size,
            sort_order: i,
          });
        }
      }
      return review;
    },
    onSuccess: () => {
      toast.success("Review submitted! It will be visible after moderation.");
      navigate(`/product/${slug}`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!user) {
    return (
      <div className="container py-20 text-center">
        <SeoHead title="Write a Review" description="Sign in to share your honest software review and help others choose the right tools on ReviewHunts." />
        <p className="text-muted-foreground mb-4">You need to sign in to write a review.</p>
        <Link to="/login"><Button>Sign In</Button></Link>
      </div>
    );
  }

  if (loadingProduct) return <div className="container py-20 text-center text-muted-foreground">Loading...</div>;
  if (!product) return <div className="container py-20 text-center text-muted-foreground">Product not found.</div>;

  return (
    <>
      <SeoHead title={`Review ${product.name}`} description={`Share your honest review of ${product.name} and help others pick the right software on ReviewHunts.`} />
      <div className="container max-w-2xl py-8">
        <Link to={`/product/${slug}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to {product.name}
        </Link>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center overflow-hidden ring-2 ring-border/30">
              {product.logo_url ? <img src={product.logo_url} alt={product.name} className="h-full w-full object-cover" /> : <span className="text-xl font-bold text-primary">{product.name.charAt(0)}</span>}
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Review {product.name}</h1>
              <p className="text-sm text-muted-foreground">Share your experience to help others</p>
            </div>
          </div>

          <div className="space-y-8">
            {/* Review template */}
            <div className="glass-card p-6">
              <ReviewTemplateSelector onSelect={(prompts) => {
                if (prompts.pros) setPros(prompts.pros);
                if (prompts.cons) setCons(prompts.cons);
                if (prompts.body) setBody(prompts.body);
              }} />
            </div>

            {/* Multi-criteria ratings */}
            <div className="glass-card p-6 space-y-5">
              <h2 className="font-display font-bold text-lg text-foreground">Ratings</h2>
              {CRITERIA.map((criterion) => (
                <div key={criterion.key} className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    {criterion.label} {"required" in criterion && <span className="text-destructive">*</span>}
                  </Label>
                  <div className="flex items-center gap-2">
                    <StarRating rating={ratings[criterion.key] || 0} size="md" interactive onChange={(v) => setRating(criterion.key, v)} />
                    <span className="text-sm font-mono text-muted-foreground w-6 text-center">{ratings[criterion.key] || "–"}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Review content */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="font-display font-bold text-lg text-foreground">Your Review</h2>
              <div>
                <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summarize your experience" maxLength={120} className="mt-1.5" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pros" className="text-[hsl(var(--success))]">👍 Pros</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
                    {PRO_TAG_OPTIONS.map((tag) => (
                      <Badge
                        key={tag}
                        variant={prosTags.includes(tag) ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer text-xs transition-colors",
                          prosTags.includes(tag) ? "bg-[hsl(var(--success))] text-white hover:bg-[hsl(var(--success)/0.9)]" : "hover:border-[hsl(var(--success)/0.5)]"
                        )}
                        onClick={() => toggleTag(tag, prosTags, setProsTags)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <Textarea id="pros" value={pros} onChange={(e) => setPros(e.target.value)} placeholder="What did you like?" rows={3} />
                </div>
                <div>
                  <Label htmlFor="cons" className="text-destructive">👎 Cons</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
                    {CON_TAG_OPTIONS.map((tag) => (
                      <Badge
                        key={tag}
                        variant={consTags.includes(tag) ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer text-xs transition-colors",
                          consTags.includes(tag) ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "hover:border-destructive/50"
                        )}
                        onClick={() => toggleTag(tag, consTags, setConsTags)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <Textarea id="cons" value={cons} onChange={(e) => setCons(e.target.value)} placeholder="What could be improved?" rows={3} />
                </div>
              </div>
              <div>
                <Label htmlFor="body">Detailed Review</Label>
                <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share more details about your experience..." rows={5} className="mt-1.5" />
              </div>
            </div>

            {/* Media upload */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="font-display font-bold text-lg text-foreground">Screenshots & Media</h2>
              <p className="text-xs text-muted-foreground">Upload up to 5 images or videos (max 5MB each)</p>
              <div className="flex flex-wrap gap-3">
                {mediaPreviews.map((url, i) => (
                  <div key={i} className="relative h-20 w-20 rounded-xl overflow-hidden border border-border group">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button onClick={() => removeMedia(i)} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {mediaFiles.length < 5 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-20 w-20 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Camera className="h-5 w-5" />
                    <span className="text-[10px]">Add</span>
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} />
            </div>

            {/* Reviewer info */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="font-display font-bold text-lg text-foreground">About You</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="role">Your Role</Label>
                  <Input id="role" value={reviewerRole} onChange={(e) => setReviewerRole(e.target.value)} placeholder="e.g., Marketing Manager" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="industry">Industry</Label>
                  <Input id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g., Healthcare" className="mt-1.5" />
                </div>
                <div>
                  <Label>Company Size</Label>
                  <Select value={companySize} onValueChange={setCompanySize}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZES.map((s) => <SelectItem key={s} value={s}>{s} employees</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Usage Duration</Label>
                  <Select value={usageDuration} onValueChange={setUsageDuration}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {USAGE_DURATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>How likely are you to recommend? ({recommendation}/10)</Label>
                <input
                  type="range" min={1} max={10} value={recommendation}
                  onChange={(e) => setRecommendation(Number(e.target.value))}
                  className="w-full mt-2 accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Not at all</span><span>Extremely likely</span>
                </div>
              </div>
            </div>

            <Button
              onClick={() => submit.mutate()}
              disabled={submit.isPending || !ratings.overall_rating || !title.trim()}
              className="w-full btn-premium text-primary-foreground rounded-xl h-12 text-base font-semibold"
            >
              {submit.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
              Submit Review
            </Button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
