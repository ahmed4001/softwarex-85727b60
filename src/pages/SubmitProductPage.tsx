import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Send, Globe, Building2, DollarSign, FileText } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export default function SubmitProductPage() {
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Tables<"categories">[]>([]);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    website_url: "",
    tagline: "",
    description: "",
    category_id: "",
    pricing_model: "",
    starting_price: "",
    headquarters: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        toast.error("Please sign in to submit a product");
        navigate("/login");
      } else {
        setUserId(data.session.user.id);
      }
    });

    supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        if (data) setCategories(data);
      });
  }, [navigate]);

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    if (!form.name.trim() || form.name.length > 200) {
      toast.error("Product name is required (max 200 characters)");
      return;
    }
    if (!form.description.trim() || form.description.length > 5000) {
      toast.error("Description is required (max 5000 characters)");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("vendor_submissions").insert({
      user_id: userId,
      product_data: {
        name: form.name.trim(),
        website_url: form.website_url.trim(),
        tagline: form.tagline.trim(),
        description: form.description.trim(),
        category_id: form.category_id || null,
        pricing_model: form.pricing_model || null,
        starting_price: form.starting_price ? Number(form.starting_price) : null,
        headquarters: form.headquarters.trim() || null,
      },
    });
    setLoading(false);

    if (error) {
      toast.error("Failed to submit. Please try again.");
      return;
    }
    toast.success("Product submitted for review! We'll get back to you soon.");
    navigate("/");
  };

  if (!userId) return null;

  return (
    <>
      <SeoHead title="Submit Your Product" description="List your software on SoftwareHub and reach thousands of potential customers." />
      <div className="min-h-[80vh] py-16 relative">
        <div className="absolute inset-0 mesh-gradient opacity-20" />
        <div className="container max-w-2xl relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-center mb-10">
              <div className="h-14 w-14 rounded-2xl gradient-hero flex items-center justify-center mx-auto mb-5">
                <Send className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-3xl font-display font-bold text-foreground">Submit Your Product</h1>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                Get your software listed on SoftwareHub. Our team will review your submission within 48 hours.
              </p>
            </div>

            <div className="glass-card p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Product Name */}
                <div>
                  <Label htmlFor="name" className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" /> Product Name *
                  </Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    required
                    maxLength={200}
                    placeholder="e.g. Acme CRM"
                    className="mt-2 h-12 rounded-xl"
                  />
                </div>

                {/* Website */}
                <div>
                  <Label htmlFor="website" className="text-sm font-semibold flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" /> Website URL
                  </Label>
                  <Input
                    id="website"
                    type="url"
                    value={form.website_url}
                    onChange={(e) => updateField("website_url", e.target.value)}
                    placeholder="https://yourproduct.com"
                    className="mt-2 h-12 rounded-xl"
                  />
                </div>

                {/* Tagline */}
                <div>
                  <Label htmlFor="tagline" className="text-sm font-semibold">Tagline</Label>
                  <Input
                    id="tagline"
                    value={form.tagline}
                    onChange={(e) => updateField("tagline", e.target.value)}
                    maxLength={200}
                    placeholder="A short catchy description"
                    className="mt-2 h-12 rounded-xl"
                  />
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="description" className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" /> Description *
                  </Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    required
                    maxLength={5000}
                    rows={5}
                    placeholder="Tell us about your product, key features, and target audience..."
                    className="mt-2 rounded-xl resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{form.description.length}/5000</p>
                </div>

                {/* Category & Pricing row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Category</Label>
                    <Select value={form.category_id} onValueChange={(v) => updateField("category_id", v)}>
                      <SelectTrigger className="mt-2 h-12 rounded-xl">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold">Pricing Model</Label>
                    <Select value={form.pricing_model} onValueChange={(v) => updateField("pricing_model", v)}>
                      <SelectTrigger className="mt-2 h-12 rounded-xl">
                        <SelectValue placeholder="Select pricing" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="freemium">Freemium</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="subscription">Subscription</SelectItem>
                        <SelectItem value="one-time">One-Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Starting Price & HQ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price" className="text-sm font-semibold flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" /> Starting Price
                    </Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.starting_price}
                      onChange={(e) => updateField("starting_price", e.target.value)}
                      placeholder="0.00"
                      className="mt-2 h-12 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="hq" className="text-sm font-semibold">Headquarters</Label>
                    <Input
                      id="hq"
                      value={form.headquarters}
                      onChange={(e) => updateField("headquarters", e.target.value)}
                      maxLength={200}
                      placeholder="e.g. San Francisco, CA"
                      className="mt-2 h-12 rounded-xl"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 btn-premium rounded-xl text-primary-foreground font-semibold gap-2"
                  disabled={loading}
                >
                  {loading ? "Submitting..." : <><Send className="h-4 w-4" /> Submit for Review</>}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Submissions are reviewed within 48 hours. You'll be notified once approved.
                </p>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
