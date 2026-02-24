import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowRight, UserPlus } from "lucide-react";

export default function LoginPage() {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    setLoginLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Welcome back!");
    navigate("/");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
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
    toast.success("Check your email to verify your account!");
  };

  return (
    <>
      <SeoHead title="Sign In or Register — SoftwareHub" description="Sign in or create an account to submit products, write reviews, and save your favorite software." />
      <div className="min-h-[80vh] flex items-center justify-center py-16 relative">
        <div className="absolute inset-0 mesh-gradient opacity-30" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm relative"
        >
          <div className="text-center mb-10">
            <div className="h-14 w-14 rounded-2xl gradient-hero flex items-center justify-center mx-auto mb-5 animate-pulse-glow">
              <span className="text-xl font-display font-black text-primary-foreground">S</span>
            </div>
            <h1 className="text-3xl font-display font-bold text-foreground">Welcome</h1>
            <p className="text-muted-foreground mt-2">Sign in or create an account</p>
          </div>

          <div className="glass-card p-8">
            <Tabs defaultValue="login">
              <TabsList className="w-full mb-6">
                <TabsTrigger value="login" className="flex-1">Sign In</TabsTrigger>
                <TabsTrigger value="register" className="flex-1">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <Label htmlFor="login-email" className="text-sm font-semibold">Email</Label>
                    <Input id="login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required placeholder="you@example.com" className="mt-2 h-12 rounded-xl" />
                  </div>
                  <div>
                    <Label htmlFor="login-password" className="text-sm font-semibold">Password</Label>
                    <Input id="login-password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required placeholder="••••••••" className="mt-2 h-12 rounded-xl" />
                  </div>
                  <Button type="submit" className="w-full h-12 btn-premium rounded-xl text-primary-foreground font-semibold gap-2" disabled={loginLoading}>
                    {loginLoading ? "Signing in..." : <>Sign In <ArrowRight className="h-4 w-4" /></>}
                  </Button>
                  <p className="text-xs text-center">
                    <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground transition-colors">Forgot password?</Link>
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-5">
                  <div>
                    <Label htmlFor="reg-name" className="text-sm font-semibold">Full Name</Label>
                    <Input id="reg-name" value={regName} onChange={(e) => setRegName(e.target.value)} required maxLength={100} placeholder="John Doe" className="mt-2 h-12 rounded-xl" />
                  </div>
                  <div>
                    <Label htmlFor="reg-email" className="text-sm font-semibold">Email</Label>
                    <Input id="reg-email" type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required placeholder="you@example.com" className="mt-2 h-12 rounded-xl" />
                  </div>
                  <div>
                    <Label htmlFor="reg-password" className="text-sm font-semibold">Password</Label>
                    <Input id="reg-password" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" className="mt-2 h-12 rounded-xl" />
                  </div>
                  <Button type="submit" className="w-full h-12 btn-premium rounded-xl text-primary-foreground font-semibold gap-2" disabled={regLoading}>
                    {regLoading ? "Creating account..." : <><UserPlus className="h-4 w-4" /> Create Account</>}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    You'll receive a verification email to confirm your account.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </motion.div>
      </div>
    </>
  );
}
