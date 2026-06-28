import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, Eye } from "lucide-react";
import { useState } from "react";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("admin_list_profiles");
      let list: any[] = data || [];
      if (search) {
        const s = search.toLowerCase();
        list = list.filter((u) => (u.name || "").toLowerCase().includes(s) || (u.email || "").toLowerCase().includes(s));
      }
      return list.slice(0, 50);
    },
  });

  return (
    <>
      <SeoHead title="Users - Admin" robots="noindex, nofollow" />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-muted-foreground">{users?.length || 0} users</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        <div className="product-card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">User</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Email</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Reviews</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Joined</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="admin-table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {u.avatar_url ? <img decoding="async" loading="lazy" src={u.avatar_url} alt="" className="h-full w-full rounded-full object-cover" /> : <span className="text-xs font-bold text-primary">{(u.name || "?").charAt(0)}</span>}
                      </div>
                      <span className="text-sm font-medium text-foreground">{u.name || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{u.review_count}</td>
                  <td className="px-4 py-3"><StatusBadge status={u.is_banned ? "inactive" : "active"} /></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>}
              {!isLoading && users?.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
