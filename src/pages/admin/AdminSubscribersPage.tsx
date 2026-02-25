import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Download, Mail, Users, TrendingUp, CheckCircle, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function AdminSubscribersPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  const { data: subscribers, isLoading: loadingSubs } = useQuery({
    queryKey: ["admin-subscribers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_subscribers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: signedUpUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ["admin-signup-emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, email, name, created_at")
        .not("email", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Merge into unified list
  const allEmails = (() => {
    const newsletterEntries = (subscribers || []).map((s) => ({
      id: s.id,
      email: s.email,
      source: "newsletter" as const,
      status: s.is_active ? "active" : "inactive",
      date: s.created_at,
      name: null as string | null,
    }));
    const signupEntries = (signedUpUsers || []).map((u) => ({
      id: u.id,
      email: u.email!,
      source: "signup" as const,
      status: "active" as const,
      date: u.created_at,
      name: u.name,
    }));
    return [...newsletterEntries, ...signupEntries];
  })();

  const filtered = allEmails
    .filter((e) => {
      if (tab === "newsletter") return e.source === "newsletter";
      if (tab === "signup") return e.source === "signup";
      return true;
    })
    .filter((e) =>
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      (e.name && e.name.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  const totalNewsletter = subscribers?.length || 0;
  const totalSignups = signedUpUsers?.length || 0;
  const totalAll = totalNewsletter + totalSignups;

  const recentCount = allEmails.filter((e) => {
    if (!e.date) return false;
    return new Date(e.date) > new Date(Date.now() - 7 * 86400000);
  }).length;

  const isLoading = loadingSubs || loadingUsers;

  const handleExportCSV = () => {
    if (!filtered.length) return;
    const header = "Email,Name,Source,Status,Date\n";
    const rows = filtered.map((e) =>
      `${e.email},${e.name || ""},${e.source},${e.status},${e.date ? format(new Date(e.date), "yyyy-MM-dd HH:mm") : ""}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `emails-${tab}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} emails`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">All Emails</h1>
          <p className="text-muted-foreground text-sm mt-1">Newsletter subscribers and registered user emails</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV} disabled={!filtered.length}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Total Emails
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-extrabold text-foreground">{totalAll}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" /> Newsletter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-extrabold text-foreground">{totalNewsletter}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Signups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-extrabold text-foreground">{totalSignups}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Last 7 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-extrabold text-foreground">{recentCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All ({totalAll})</TabsTrigger>
            <TabsTrigger value="newsletter">Newsletter ({totalNewsletter})</TabsTrigger>
            <TabsTrigger value="signup">Signups ({totalSignups})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Mail className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm">No emails found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => (
                  <TableRow key={`${e.source}-${e.id}`}>
                    <TableCell className="font-medium">{e.email}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{e.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={e.source === "signup" ? "outline" : "secondary"} className="text-[11px]">
                        {e.source === "signup" ? "Signup" : "Newsletter"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.status === "active" ? "default" : "secondary"} className="text-[11px]">
                        {e.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {e.date ? format(new Date(e.date), "MMM d, yyyy 'at' h:mm a") : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
