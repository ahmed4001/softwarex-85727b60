import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface RequireAdminProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function RequireAdmin({ children, redirectTo = "/login" }: RequireAdminProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate(redirectTo, { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      const [adminRes, superRes] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" as any }),
        supabase.rpc("has_role", { _user_id: user.id, _role: "superadmin" as any }),
      ]);
      if (cancelled) return;
      setIsAdmin(Boolean(adminRes.data) || Boolean(superRes.data));
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [loading, user, navigate, redirectTo]);

  if (loading || !user || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-2xl font-semibold">403 — Forbidden</h1>
          <p className="text-muted-foreground">You don't have permission to access the admin area.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
