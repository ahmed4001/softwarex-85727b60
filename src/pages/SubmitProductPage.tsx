import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Globe, Building2, DollarSign, FileText, User, Mail, Lock, ArrowRight, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";

export default function SubmitProductPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Tables<"categories">[]>([]);
  const [step, setStep] = useState<"product" | "account">("product");

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

  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    fullName: "",
  });
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [authLoading2, setAuthLoading2] = useState(false);

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        if (data) setCategories(data);
      });
  }, []);

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const validateProduct = () => {
    if (!form.name.trim() || form.name.length > 200) {
      toast.error("Product name is required (max 200 characters)");
      return false;
    }
    if (!form.description.trim()) {
      toast.error("Description is required");
      return false;
    }
    return true;
  };

  const handleContinue = () => {
    if (!validateProduct()) return;
    if (user) {
      submitProduct(user.id);
    } else {
      setStep("account");
    }
  };

  const submitProduct = async (userId: string) => {
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setAuthLoading2(true);

    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: authForm.email.trim(),
        password: authForm.password,
        options: {
          data: { name: authForm.fullName.trim() },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        toast.error(error.message);
        setAuthLoading2(false);
        return;
      }

      if (data.user && data.session) {
        // Auto-confirmed or session available
        setAuthLoading2(false);
        await submitProduct(data.user.id);
      } else if (data.user) {
        toast.success("Check your email to verify your account, then submit again!");
        setAuthLoading2(false);
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authForm.email.trim(),
        password: authForm.password,
      });

      if (error) {
        toast.error(error.message);
        setAuthLoading2(false);
        return;
      }

      setAuthLoading2(false);
      if (data.user) {
        await submitProduct(data.user.id);
      }
    }
  };

  return (
    <>
      <SeoHead title="Submit Your Product" description="List your software on SoftwareHub and reach thousands of potential customers." />
      <div className="min-h-[80vh] py-16 relative">
        <div className="absolute inset-0 mesh-gradient opacity-20" />
        <div className="container max-w-2xl relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-center mb-10">
              <div className="h-14 w-14 rounded-2xl gradient-hero flex items-center justify-center mx-auto mb-5">
                <Send className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-3xl font-display font-bold text-foreground">Submit Your Product</h1>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                Get your software listed on SoftwareHub. Our team will review your submission within 48 hours.
              </p>
            </div>

            {/* Step indicators */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${step === "product" ? "bg-primary text-primary-foreground" : "bg-primary/20 text-primary"}`}>
                  {step === "account" ? <CheckCircle2 className="h-4 w-4" /> : "1"}
                </div>
                <span className="text-sm font-medium text-foreground">Product Info</span>
              </div>
              <div className="h-px w-8 bg-border" />
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${step === "account" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {user ? <CheckCircle2 className="h-4 w-4" /> : "2"}
                </div>
                <span className={`text-sm font-medium ${step === "account" ? "text-foreground" : "text-muted-foreground"}`}>
                  {user ? "Signed In" : "Account"}
                </span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {step === "product" ? (
                <motion.div
                  key="product"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="glass-card p-8">
                    <div className="space-y-6">
                      <div>
                        <Label htmlFor="name" className="text-sm font-semibold flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" /> Product Name *
                        </Label>
                        <Input id="name" value={form.name} onChange={(e) => updateField("name", e.target.value)} required maxLength={200} placeholder="e.g. Acme CRM" className="mt-2 h-12 rounded-xl" />
                      </div>

                      <div>
                        <Label htmlFor="website" className="text-sm font-semibold flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" /> Website URL
                        </Label>
                        <Input id="website" type="url" value={form.website_url} onChange={(e) => updateField("website_url", e.target.value)} placeholder="https://yourproduct.com" className="mt-2 h-12 rounded-xl" />
                      </div>

                      <div>
                        <Label htmlFor="tagline" className="text-sm font-semibold">Tagline</Label>
                        <Input id="tagline" value={form.tagline} onChange={(e) => updateField("tagline", e.target.value)} maxLength={200} placeholder="A short catchy description" className="mt-2 h-12 rounded-xl" />
                      </div>

                      <div>
                        <Label htmlFor="description" className="text-sm font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" /> Description *
                        </Label>
                        <div className="mt-2">
                          <RichTextEditor value={form.description} onChange={(html) => updateField("description", html)} placeholder="Tell us about your product, key features, and target audience..." />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-semibold">Category</Label>
                          <Select value={form.category_id} onValueChange={(v) => updateField("category_id", v)}>
                            <SelectTrigger className="mt-2 h-12 rounded-xl"><SelectValue placeholder="Select category" /></SelectTrigger>
                            <SelectContent>
                              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-sm font-semibold">Pricing Model</Label>
                          <Select value={form.pricing_model} onValueChange={(v) => updateField("pricing_model", v)}>
                            <SelectTrigger className="mt-2 h-12 rounded-xl"><SelectValue placeholder="Select pricing" /></SelectTrigger>
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="price" className="text-sm font-semibold flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" /> Starting Price
                          </Label>
                          <Input id="price" type="number" min="0" step="0.01" value={form.starting_price} onChange={(e) => updateField("starting_price", e.target.value)} placeholder="0.00" className="mt-2 h-12 rounded-xl" />
                        </div>
                        <div>
                          <Label htmlFor="hq" className="text-sm font-semibold">Headquarters</Label>
                          <Input id="hq" value={form.headquarters} onChange={(e) => updateField("headquarters", e.target.value)} maxLength={200} placeholder="e.g. San Francisco, CA" className="mt-2 h-12 rounded-xl" />
                        </div>
                      </div>

                      <Button
                        type="button"
                        onClick={handleContinue}
                        className="w-full h-12 btn-premium rounded-xl text-primary-foreground font-semibold gap-2"
                        disabled={loading}
                      >
                        {loading ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                        ) : user ? (
                          <><Send className="h-4 w-4" /> Submit for Review</>
                        ) : (
                          <><ArrowRight className="h-4 w-4" /> Continue to Create Account</>
                        )}
                      </Button>

                      {user && (
                        <p className="text-xs text-center text-muted-foreground">
                          Signed in as {user.email}. Submissions are reviewed within 48 hours.
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="account"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="glass-card p-8">
                    <div className="mb-6">
                      <button
                        onClick={() => setStep("product")}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" /> Back to product info
                      </button>
                    </div>

                    <div className="rounded-xl bg-muted/50 p-4 mb-6">
                      <p className="text-xs text-muted-foreground mb-1">Submitting:</p>
                      <p className="text-sm font-semibold text-foreground">{form.name}</p>
                      {form.tagline && <p className="text-xs text-muted-foreground mt-0.5">{form.tagline}</p>}
                    </div>

                    <div className="flex gap-2 mb-6">
                      <Button
                        variant={authMode === "signup" ? "default" : "outline"}
                        size="sm"
                        className="flex-1 rounded-lg"
                        onClick={() => setAuthMode("signup")}
                      >
                        Create Account
                      </Button>
                      <Button
                        variant={authMode === "signin" ? "default" : "outline"}
                        size="sm"
                        className="flex-1 rounded-lg"
                        onClick={() => setAuthMode("signin")}
                      >
                        Sign In
                      </Button>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-4">
                      {authMode === "signup" && (
                        <div>
                          <Label htmlFor="fullName" className="text-sm font-semibold flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" /> Full Name
                          </Label>
                          <Input
                            id="fullName"
                            value={authForm.fullName}
                            onChange={(e) => setAuthForm((p) => ({ ...p, fullName: e.target.value }))}
                            placeholder="Your name"
                            className="mt-2 h-12 rounded-xl"
                          />
                        </div>
                      )}

                      <div>
                        <Label htmlFor="email" className="text-sm font-semibold flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" /> Email *
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          required
                          value={authForm.email}
                          onChange={(e) => setAuthForm((p) => ({ ...p, email: e.target.value }))}
                          placeholder="you@company.com"
                          className="mt-2 h-12 rounded-xl"
                        />
                      </div>

                      <div>
                        <Label htmlFor="password" className="text-sm font-semibold flex items-center gap-2">
                          <Lock className="h-4 w-4 text-muted-foreground" /> Password *
                        </Label>
                        <Input
                          id="password"
                          type="password"
                          required
                          minLength={6}
                          value={authForm.password}
                          onChange={(e) => setAuthForm((p) => ({ ...p, password: e.target.value }))}
                          placeholder="Min. 6 characters"
                          className="mt-2 h-12 rounded-xl"
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-12 btn-premium rounded-xl text-primary-foreground font-semibold gap-2"
                        disabled={authLoading2 || loading}
                      >
                        {authLoading2 ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> {authMode === "signup" ? "Creating Account..." : "Signing In..."}</>
                        ) : (
                          <><Send className="h-4 w-4" /> {authMode === "signup" ? "Create Account & Submit" : "Sign In & Submit"}</>
                        )}
                      </Button>

                      {authMode === "signup" && (
                        <p className="text-xs text-center text-muted-foreground">
                          You'll receive a verification email to confirm your account.
                        </p>
                      )}
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </>
  );
}
