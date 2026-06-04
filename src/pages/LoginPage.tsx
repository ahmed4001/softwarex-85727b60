import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowRight, UserPlus, Mail, Lock, User, Eye, EyeOff, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import softwareCollage from "@/assets/software-collage.jpg";




export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);


  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [showRegPass, setShowRegPass] = useState(false);

  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoginLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("login.welcomeBack"));
    navigate("/");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword.length < 6) { toast.error(t("login.passwordMin")); return; }
    setRegLoading(true);
    const { error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: {
        data: { name: regName.trim() },
        emailRedirectTo: window.location.origin,
      },
    });
    setRegLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("login.welcomeBack"));
    navigate("/");
  };


  const strengthScore = regPassword.length === 0 ? 0 : regPassword.length < 4 ? 1 : regPassword.length < 8 ? 2 : regPassword.length < 12 ? 3 : 4;
  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthColors = ["", "hsl(0 72% 50%)", "hsl(38 92% 50%)", "hsl(152 60% 52%)", "hsl(152 60% 42%)"];

  return (
    <>
      <SeoHead title={`${isLogin ? t("login.signIn") : t("login.register")} — ReviewHunts`} description={t("login.subtitle")} />
      <div className="min-h-[calc(100vh-4rem)] grid lg:grid-cols-2">
        {/* Left — editorial image + overlay */}
        <div className="hidden lg:block relative overflow-hidden">
          <img
            src={softwareCollage}
            alt="Software tools workspace"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/80 via-foreground/60 to-primary/40" />
          <div className="absolute inset-0 mix-blend-multiply opacity-30"
            style={{ background: "url('data:image/svg+xml,%3Csvg width=\"40\" height=\"40\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath d=\"M0 0h40v40H0z\" fill=\"none\"/%3E%3Cpath d=\"M0 40L40 0\" stroke=\"rgba(255,255,255,0.06)\" stroke-width=\"1\"/%3E%3C/svg%3E')" }}
          />

          <div className="relative z-10 flex flex-col justify-between h-full p-10 xl:p-14">
            <div />

            <div className="max-w-md">
              <motion.blockquote
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="space-y-6"
              >
                <p className="text-2xl xl:text-3xl font-serif text-white leading-snug" style={{ fontFamily: "'EB Garamond', serif" }}>
                  "We found three tools that cut our costs by 40% — all from reading reviews here."
                </p>
                <footer className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-semibold text-sm border border-white/10">
                    MK
                  </div>
                  <div>
                    <p className="text-white/90 font-medium text-sm">Maria Kovacs</p>
                    <p className="text-white/50 text-xs">CTO, Meridian Labs</p>
                  </div>
                </footer>
              </motion.blockquote>
            </div>

            <div className="flex items-center gap-6 text-white/40 text-xs font-medium tracking-wider uppercase">
              <span>50K+ Users</span>
              <span className="w-px h-3 bg-white/20" />
              <span>12K+ Reviews</span>
              <span className="w-px h-3 bg-white/20" />
              <span>3K+ Products</span>
            </div>
          </div>
        </div>

        {/* Right — form */}
        <div className="flex items-center justify-center px-6 py-12 sm:px-12 bg-background relative">
          {/* Subtle corner accent */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/3 rounded-bl-[120px]" />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-[380px] relative z-10"
          >
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground tracking-tight">
                {isLogin ? "Welcome back" : "Get started"}
              </h1>
              <p className="text-muted-foreground mt-2 text-[15px]">
                {isLogin
                  ? "Sign in to access your dashboard and reviews."
                  : "Create a free account to start discovering software."}
              </p>
            </div>

            {/* Form */}

            <motion.div
              key={isLogin ? "login" : "register"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {isLogin ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("login.email")}</Label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors" />
                      <Input id="login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required placeholder="you@company.com" className="h-11 pl-9 bg-transparent border-border hover:border-foreground/20 focus:border-primary transition-colors rounded-lg" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("login.password")}</Label>
                      <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t("login.forgotPassword")}</Link>
                    </div>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors" />
                      <Input id="login-password" type={showLoginPass ? "text" : "password"} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required placeholder="••••••••" className="h-11 pl-9 pr-9 bg-transparent border-border hover:border-foreground/20 focus:border-primary transition-colors rounded-lg" />
                      <button type="button" onClick={() => setShowLoginPass(!showLoginPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors" tabIndex={-1}>
                        {showLoginPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                    />
                    <Label htmlFor="remember" className="text-sm text-muted-foreground font-normal cursor-pointer">
                      Remember me
                    </Label>
                  </div>
                  <Button type="submit" className="w-full h-11 rounded-lg font-semibold gap-2 mt-2" disabled={loginLoading}>
                    {loginLoading ? (
                      <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Signing in…</span>
                    ) : (
                      <>Sign in <ArrowRight className="h-4 w-4" /></>
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("login.fullName")}</Label>
                    <div className="relative group">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors" />
                      <Input id="reg-name" value={regName} onChange={(e) => setRegName(e.target.value)} required maxLength={100} placeholder="Jane Smith" className="h-11 pl-9 bg-transparent border-border hover:border-foreground/20 focus:border-primary transition-colors rounded-lg" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("login.email")}</Label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors" />
                      <Input id="reg-email" type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required placeholder="you@company.com" className="h-11 pl-9 bg-transparent border-border hover:border-foreground/20 focus:border-primary transition-colors rounded-lg" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("login.password")}</Label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors" />
                      <Input id="reg-password" type={showRegPass ? "text" : "password"} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" className="h-11 pl-9 pr-9 bg-transparent border-border hover:border-foreground/20 focus:border-primary transition-colors rounded-lg" />
                      <button type="button" onClick={() => setShowRegPass(!showRegPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors" tabIndex={-1}>
                        {showRegPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {regPassword.length > 0 && (
                      <div className="flex items-center gap-2 pt-1">
                        <div className="flex gap-1 flex-1">
                          {[1, 2, 3, 4].map((level) => (
                            <div
                              key={level}
                              className="h-0.5 flex-1 rounded-full transition-all duration-500"
                              style={{ background: strengthScore >= level ? strengthColors[strengthScore] : "hsl(var(--border))" }}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] font-medium" style={{ color: strengthColors[strengthScore] }}>
                          {strengthLabels[strengthScore]}
                        </span>
                      </div>
                    )}
                  </div>
                  <Button type="submit" className="w-full h-11 rounded-lg font-semibold gap-2 mt-2" disabled={regLoading}>
                    {regLoading ? (
                      <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Creating account…</span>
                    ) : (
                      <><UserPlus className="h-4 w-4" /> Create account</>
                    )}
                  </Button>
                  <p className="text-[11px] text-center text-muted-foreground pt-1">
                    {t("login.verifyEmail")}
                  </p>
                </form>
              )}
            </motion.div>

            {/* Toggle */}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border hover:border-foreground/15 bg-muted/30 hover:bg-muted/60 transition-all group text-sm mt-8"
            >
              <span className="text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
              </span>
              <span className="flex items-center gap-1 font-semibold text-foreground group-hover:text-primary transition-colors">
                {isLogin ? "Sign up" : "Sign in"}
                <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>

            {/* Footer */}
            <p className="text-[11px] text-center text-muted-foreground/60 mt-8">
              By continuing, you agree to our{" "}
              <Link to="/page/terms" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">Terms</Link>{" & "}
              <Link to="/page/privacy" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">Privacy</Link>.
            </p>
          </motion.div>
        </div>
      </div>
    </>
  );
}
