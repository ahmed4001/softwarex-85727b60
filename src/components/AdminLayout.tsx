import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { RequireAdmin } from "@/components/RequireAdmin";

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  // Full-screen distraction-free editor for blog write/edit
  const isFullScreen = /^\/admin\/blog\/(new|[^/]+\/edit)$/.test(pathname);

  if (isFullScreen) {
    return (
      <RequireAdmin>
        <main className="min-h-screen bg-background">
          <Outlet />
        </main>
      </RequireAdmin>
    );
  }

  return (
    <RequireAdmin>
      <div className="flex min-h-screen">
        <AdminSidebar collapsed={collapsed} />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminHeader collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
          <main className="flex-1 p-6 bg-background">
            <Outlet />
          </main>
        </div>
      </div>
    </RequireAdmin>
  );
}
