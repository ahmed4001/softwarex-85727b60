import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CreditCard,
  Lock,
  ArrowLeft,
  Sparkles,
  Loader2,
  AlertTriangle,
  Terminal,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { SeoHead } from "@/components/SeoHead";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";

const planPricing: Record<string, { name: string; price: number }> = {
  featured: { name: "Featured", price: 29 },
  promotion: { name: "Promotion", price: 99 },
  premium: { name: "Premium", price: 199 },
};

type ConfirmedSub = {
  plan: string;
  status: string;
  started_at: string | null;
  expires_at: string | null;
};

// Session-cache helpers — avoid hitting the DB when the webhook has already
// confirmed this subscription in the current browser session.
const SUB_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const subCacheKey = (userId: string) => `rh:vendor_sub:${userId}`;

function readCachedSub(userId: string, expectedPlan: string): ConfirmedSub | null {
  try {
    const raw = sessionStorage.getItem(subCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { sub: ConfirmedSub; cachedAt: number };
    if (Date.now() - parsed.cachedAt > SUB_CACHE_TTL_MS) return null;
    if (parsed.sub.plan !== expectedPlan || parsed.sub.status !== "active") return null;
    return parsed.sub;
  } catch {
    return null;
  }
}

function writeCachedSub(userId: string, sub: ConfirmedSub) {
  try {
    sessionStorage.setItem(
      subCacheKey(userId),
      JSON.stringify({ sub, cachedAt: Date.now() }),
    );
  } catch {
    /* sessionStorage unavailable — ignore */
  }
}

export default function CheckoutPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [paddleError, setPaddleError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmedSub, setConfirmedSub] = useState<ConfirmedSub | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const hasLoggedRef = useRef(false);
  const planId = params.get("plan") || "featured";
  const plan = planPricing[planId] || planPricing.featured;

  // Confirm the new plan after checkout — tiered to minimize backend cost:
  //   Tier 0: Session cache (sessionStorage) — zero network, instant.
  //   Tier 1: Realtime channel — webhook write notifies us, zero polling.
  //   Tier 2: Exponential-backoff DB poll (≤5 reads, paused while tab hidden).
  // Every confirmation (any tier) is written back to the cache so subsequent
  // visits in the same session skip the DB entirely.
  const fetchActiveSub = async (expectedPlan: string): Promise<ConfirmedSub | null> => {
    if (!user) return null;
    const { data } = await supabase
      .from("vendor_subscriptions")
      .select("plan,status,started_at,expires_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data && data.plan === expectedPlan ? (data as ConfirmedSub) : null;
  };

  const confirmAfterCheckout = async () => {
    if (!user) return;
    setConfirming(true);
    setConfirmError(null);

    // Tier 0: session cache — short-circuit if we already confirmed this plan
    // in the current session (e.g. user reopened checkout after paying).
    const cached = readCachedSub(user.id, planId);
    if (cached) {
      console.log("[Paddle.js] Subscription confirmed from session cache", cached);
      setConfirming(false);
      setConfirmedSub(cached);
      toast.success(`Your ${planPricing[cached.plan]?.name ?? cached.plan} plan is active!`);
      return;
    }

    let settled = false;
    const finish = (sub: ConfirmedSub | null) => {
      if (settled) return;
      settled = true;
      setConfirming(false);
      if (sub) {
        writeCachedSub(user.id, sub);
        setConfirmedSub(sub);
        toast.success(`Your ${planPricing[sub.plan]?.name ?? sub.plan} plan is active!`);
      } else {
        const reason =
          "Payment received, but we couldn't confirm your subscription yet. It may take a moment — you can refresh or open your dashboard.";
        setConfirmError(reason);
        toast.warning(reason);
      }
    };

    // Tier 1: realtime listener — fires once the webhook writes the row.
    const channel = supabase
      .channel(`vendor_sub_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendor_subscriptions", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const row = payload.new;
          if (row?.status === "active" && row?.plan === planId) {
            console.log("[Paddle.js] Realtime confirmed subscription", row);
            finish(row as ConfirmedSub);
            supabase.removeChannel(channel);
          }
        },
      )
      .subscribe();

    // Tier 2: fallback exponential-backoff poll (max 5 reads ≈ 30s).
    const delays = [1500, 3000, 5000, 8000, 12000];
    for (let i = 0; i < delays.length && !settled; i++) {
      await new Promise((r) => setTimeout(r, delays[i]));
      if (settled) break;
      if (typeof document !== "undefined" && document.hidden) {
        // Skip this attempt; tab is hidden — realtime will still wake us.
        continue;
      }
      const sub = await fetchActiveSub(planId);
      console.log(`[Paddle.js] Poll ${i + 1}/${delays.length}`, sub ? "hit" : "miss");
      if (sub) {
        finish(sub);
        break;
      }
    }

    supabase.removeChannel(channel);
    if (!settled) finish(null);
  };

  useEffect(() => {
    if (hasLoggedRef.current) return;
    hasLoggedRef.current = true;

    const win = window as any;
    const preloaded = win.__paddleLoaded === true;
    const paddleObj = typeof win.Paddle !== "undefined";
    const preloadError = win.__paddleLoadError as string | undefined;

    console.log("[Paddle.js] CheckoutPage mount - diagnostics:", {
      preloadedScriptSuccess: preloaded,
      windowPaddleExists: paddleObj,
      preloadError: preloadError || null,
      userAgent: navigator.userAgent.slice(0, 60),
    });

    if (preloadError) {
      console.error("[Paddle.js] Preload script reported error:", preloadError);
      setPaddleError(preloadError);
    } else if (!paddleObj && !preloaded) {
      const reason =
        "Paddle.js is not available. It may have been blocked by a browser extension, firewall, or cookie-consent tool.";
      console.warn("[Paddle.js]", reason);
      setPaddleError(reason);
    }
  }, []);

  const attemptInitializePaddle = async () => {
    console.log("[Paddle.js] attemptInitializePaddle invoked — fetching checkout config");
    const { data, error } = await supabase.functions.invoke("paddle-create-checkout", {
      body: { plan: planId },
    });
    if (error) {
      const ctxErr = error.context instanceof Response ? await error.context.clone().json().catch(() => null) : null;
      throw new Error(ctxErr?.error || error.message || "Checkout failed");
    }
    if (data?.error) throw new Error(data.error);
    if (!data?.clientToken || !data?.priceId) throw new Error("Checkout configuration missing");

    console.log("[Paddle.js] Checkout config received:", {
      environment: data.environment,
      priceId: data.priceId,
      hasClientToken: !!data.clientToken,
    });

    let paddle: Paddle | undefined;
    try {
      paddle = await initializePaddle({
        environment: data.environment === "production" ? "production" : "sandbox",
        token: data.clientToken,
        eventCallback: (ev) => {
          console.log("[Paddle.js] Checkout event:", ev.name, ev);
          if (ev.name === "checkout.completed") {
            toast.success("Payment received — confirming your subscription…");
            setLoading(false);
            // Kick off the post-checkout verification instead of redirecting blindly.
            confirmAfterCheckout();
          }
          if (ev.name === "checkout.error") {
            toast.error("Checkout error. Please try again.");
            setLoading(false);
          }
          if (ev.name === "checkout.closed") {
            setLoading(false);
          }
        },
      });
    } catch (initErr: any) {
      console.error("[Paddle.js] initializePaddle threw:", initErr);
      setPaddleError(initErr.message || "Paddle failed to initialize.");
      throw initErr;
    }

    if (!paddle) {
      const reason = "Could not initialize Paddle. The library may be blocked or the token is invalid.";
      console.error("[Paddle.js]", reason);
      setPaddleError(reason);
      throw new Error(reason);
    }

    console.log("[Paddle.js] Opening checkout overlay");
    paddle.Checkout.open({
      items: [{ priceId: data.priceId, quantity: 1 }],
      customer: { email: data.email },
      customData: { user_id: data.userId, plan: planId },
      settings: {
        displayMode: "overlay",
        theme: "light",
      },
    });
  };

  const handlePay = async () => {
    if (!user) {
      navigate(`/login?redirect=/checkout?plan=${planId}`);
      return;
    }
    setLoading(true);
    setPaddleError(null);

    try {
      await attemptInitializePaddle();
    } catch (err: any) {
      console.error("[Paddle.js] handlePay caught error:", err);
      toast.error(err.message || "Checkout failed. Please try again.");
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    console.log("[Paddle.js] User clicked retry — clearing error and re-attempting");
    setPaddleError(null);
    setLoading(true);
    try {
      await attemptInitializePaddle();
    } catch (err: any) {
      console.error("[Paddle.js] Retry attempt failed:", err);
      toast.error(err.message || "Retry failed. Paddle is still unavailable.");
      setLoading(false);
    }
  };

  return (
    <>
      <SeoHead title={`Checkout — ${plan.name} Plan`} description="Complete your subscription on ReviewHunts." />
      <div className="py-6 relative">
        <div className="absolute inset-0 mesh-gradient opacity-20" />
        <div className="container max-w-2xl relative">
          <button
            onClick={() => navigate("/choose-plan")}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to plans
          </button>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-center mb-4">
              <div className="h-10 w-10 rounded-xl gradient-hero flex items-center justify-center mx-auto mb-2">
                <CreditCard className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-display font-bold">Complete your purchase</h1>
              <p className="text-xs text-muted-foreground mt-1">You're one step away from going live.</p>
            </div>

            {(confirming || confirmedSub || confirmError) && (
              <Alert
                variant={confirmError ? "destructive" : "default"}
                className="mb-6 border-primary/30 bg-primary/5"
              >
                {confirming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : confirmedSub ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {confirming
                    ? "Confirming your subscription…"
                    : confirmedSub
                      ? `${planPricing[confirmedSub.plan]?.name ?? confirmedSub.plan} plan is now active`
                      : "Subscription not confirmed yet"}
                </AlertTitle>
                <AlertDescription className="space-y-3">
                  {confirming && (
                    <p>We're waiting for Paddle to notify us. This usually takes a few seconds.</p>
                  )}
                  {confirmedSub && (
                    <div className="text-sm space-y-1">
                      <p>
                        <span className="font-medium">Status:</span> {confirmedSub.status}
                      </p>
                      {confirmedSub.started_at && (
                        <p>
                          <span className="font-medium">Started:</span>{" "}
                          {new Date(confirmedSub.started_at).toLocaleString()}
                        </p>
                      )}
                      {confirmedSub.expires_at && (
                        <p>
                          <span className="font-medium">Renews:</span>{" "}
                          {new Date(confirmedSub.expires_at).toLocaleString()}
                        </p>
                      )}
                      <div className="pt-2">
                        <Button size="sm" onClick={() => navigate("/dashboard?paid=1&plan=" + confirmedSub.plan)}>
                          Go to dashboard
                        </Button>
                      </div>
                    </div>
                  )}
                  {confirmError && !confirming && (
                    <div className="flex flex-wrap items-center gap-3">
                      <p>{confirmError}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={confirmAfterCheckout}
                        className="gap-2"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Re-check status
                      </Button>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}


            {paddleError && (
              <Alert variant="destructive" className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Checkout unavailable</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>{paddleError}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRetry}
                      disabled={loading}
                      className="gap-2"
                    >
                      {loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      {loading ? "Retrying…" : "Retry Paddle"}
                    </Button>
                  </div>
                  <details className="text-xs opacity-80">
                    <summary className="cursor-pointer font-medium inline-flex items-center gap-1">
                      <Terminal className="h-3 w-3" /> View technical details
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap">
                      {`User-Agent: ${navigator.userAgent}
window.Paddle defined: ${"Paddle" in window}
window.__paddleLoaded: ${(window as any).__paddleLoaded ?? "undefined"}
window.__paddleLoadError: ${(window as any).__paddleLoadError ?? "undefined"}`}
                    </pre>
                  </details>
                </AlertDescription>
              </Alert>
            )}

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
                    <p className="font-semibold text-foreground">Secure checkout via Paddle</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      A secure Paddle overlay will open to complete your subscription. Cancel anytime.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={paddleError ? handleRetry : handlePay}
                  disabled={loading}
                  className="w-full h-12 btn-premium rounded-xl text-primary-foreground font-semibold gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Opening checkout…
                    </>
                  ) : paddleError ? (
                    <>
                      <RefreshCw className="h-4 w-4" /> Retry Paddle Checkout
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" /> Pay ${plan.price}.00 & Subscribe
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
                  <Lock className="h-3 w-3" /> Encrypted & secure — no charge until confirmed
                </p>
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground mt-6">
              Need help?{" "}
              <Link to="/page/contact" className="text-primary hover:underline font-medium">
                Contact support
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </>
  );
}
