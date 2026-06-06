import { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CreditCard, Lock, ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SeoHead } from "@/components/SeoHead";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const planPricing: Record<string, { name: string; price: number }> = {
  featured: { name: "Featured", price: 29 },
  promotion: { name: "Promotion", price: 99 },
  premium: { name: "Premium", price: 199 },
};

export default function CheckoutPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const planId = params.get("plan") || "featured";
  const plan = planPricing[planId] || planPricing.featured;

  const handlePay = async () => {
    if (!user) {
      navigate(`/login?redirect=/checkout?plan=${planId}`);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("paddle-create-checkout", {
        body: { plan: planId },
      });
      if (error) throw error;
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error(data?.error || "Could not start checkout");
      }
    } catch (err: any) {
      toast.error(err.message || "Checkout failed. Please try again.");
      setLoading(false);
    }
  };


  return (
    <>
      <SeoHead title={`Checkout — ${plan.name} Plan`} description="Complete your subscription on ReviewHunts." />
      <div className="min-h-[80vh] py-12 md:py-16 relative">
        <div className="absolute inset-0 mesh-gradient opacity-20" />
        <div className="container max-w-3xl relative">
          <button
            onClick={() => navigate("/choose-plan")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to plans
          </button>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-center mb-8">
              <div className="h-14 w-14 rounded-2xl gradient-hero flex items-center justify-center mx-auto mb-5">
                <CreditCard className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-3xl font-display font-bold">Complete your purchase</h1>
              <p className="text-muted-foreground mt-2">You're one step away from going live.</p>
            </div>

            <Card className="glass-card">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-center justify-between pb-5 border-b border-border">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Selected Plan</p>
                    <p className="text-lg font-bold mt-0.5">{plan.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-display font-bold">${plan.price}</p>
                    <p className="text-xs text-muted-foreground">per month</p>
                  </div>
                </div>

                <div className="py-5 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">${plan.price}.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-medium">Calculated at checkout</span>
                  </div>
                  <div className="flex justify-between text-base font-bold pt-3 border-t border-border">
                    <span>Total due today</span>
                    <span>${plan.price}.00</span>
                  </div>
                </div>

                <div className="rounded-xl bg-primary/5 border border-primary/15 p-4 mb-5 flex gap-3">
                  <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-foreground">Secure payment gateway setup in progress</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Once enabled, you'll be securely redirected to complete your subscription. Cancel anytime.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handlePay}
                  className="w-full h-12 btn-premium rounded-xl text-primary-foreground font-semibold gap-2"
                >
                  <Lock className="h-4 w-4" /> Pay ${plan.price}.00 & Subscribe
                </Button>

                <p className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
                  <Lock className="h-3 w-3" /> Encrypted & secure — no charge until confirmed
                </p>
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground mt-6">
              Need help?{" "}
              <Link to="/page/contact" className="text-primary hover:underline font-medium">Contact support</Link>
            </p>
          </motion.div>
        </div>
      </div>
    </>
  );
}
