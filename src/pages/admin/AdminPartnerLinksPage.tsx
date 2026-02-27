import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ExternalLink, Handshake } from "lucide-react";

interface PartnerLink {
  id: string;
  name: string;
  url: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

interface PartnerApplication {
  id: string;
  website_name: string;
  website_url: string;
  contact_email: string;
  message: string | null;
  status: string;
  created_at: string;
}

const sb = supabase as any;

export default function AdminPartnerLinksPage() {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<PartnerLink> | null>(null);

  const { data: links, isLoading } = useQuery({
    queryKey: ["admin-partner-links"],
    queryFn: async () => {
      const { data } = await sb.from("partner_links").select("*").order("sort_order");
      return (data || []) as PartnerLink[];
    },
  });

  const { data: applications } = useQuery({
    queryKey: ["admin-partner-applications"],
    queryFn: async () => {
      const { data } = await sb.from("partner_applications").select("*").order("created_at", { ascending: false });
      return (data || []) as PartnerApplication[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (link: Partial<PartnerLink>) => {
      if (link.id) {
        const { error } = await sb.from("partner_links").update({
          name: link.name, url: link.url, description: link.description,
          logo_url: link.logo_url, is_active: link.is_active, sort_order: link.sort_order,
        }).eq("id", link.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("partner_links").insert([{
          name: link.name, url: link.url, description: link.description,
          logo_url: link.logo_url, is_active: link.is_active ?? true, sort_order: link.sort_order ?? 0,
        }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-partner-links"] });
      toast.success("Partner link saved");
      setEditOpen(false);
      setEditing(null);
    },
    onError: () => toast.error("Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("partner_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-partner-links"] });
      toast.success("Deleted");
    },
  });

  const updateAppStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await sb.from("partner_applications").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-partner-applications"] });
      toast.success("Status updated");
    },
  });

  const openNew = () => {
    setEditing({ name: "", url: "", description: "", logo_url: "", is_active: true, sort_order: 0 });
    setEditOpen(true);
  };

  const openEdit = (link: PartnerLink) => {
    setEditing({ ...link });
    setEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Handshake className="w-6 h-6 text-primary" /> Partner Links
          </h1>
          <p className="text-sm text-muted-foreground">Manage partner links and review applications.</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Add Partner</Button>
      </div>

      <Tabs defaultValue="links">
        <TabsList>
          <TabsTrigger value="links">Partner Links ({links?.length || 0})</TabsTrigger>
          <TabsTrigger value="applications">Applications ({applications?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="links">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : !links?.length ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No partner links yet</TableCell></TableRow>
                  ) : links.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {link.logo_url && <img src={link.logo_url} alt="" className="w-6 h-6 rounded object-contain" />}
                          <span className="font-medium">{link.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <a href={link.url} target="_blank" rel="noopener" className="text-primary hover:underline text-sm flex items-center gap-1">
                          {link.url.replace(/^https?:\/\//, "").slice(0, 30)} <ExternalLink className="w-3 h-3" />
                        </a>
                      </TableCell>
                      <TableCell>{link.sort_order}</TableCell>
                      <TableCell><Badge variant={link.is_active ? "default" : "secondary"}>{link.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(link)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(link.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Website</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!applications?.length ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No applications yet</TableCell></TableRow>
                  ) : applications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">{app.website_name}</TableCell>
                      <TableCell>
                        <a href={app.website_url} target="_blank" rel="noopener" className="text-primary hover:underline text-sm flex items-center gap-1">
                          {app.website_url.replace(/^https?:\/\//, "").slice(0, 25)} <ExternalLink className="w-3 h-3" />
                        </a>
                      </TableCell>
                      <TableCell className="text-sm">{app.contact_email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-48 truncate">{app.message || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={app.status === "approved" ? "default" : app.status === "rejected" ? "destructive" : "secondary"}>
                          {app.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(app.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => updateAppStatus.mutate({ id: app.id, status: "approved" })} disabled={app.status === "approved"}>
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => updateAppStatus.mutate({ id: app.id, status: "rejected" })} disabled={app.status === "rejected"}>
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit/Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Partner" : "Add Partner"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(editing!); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={editing?.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>URL *</Label>
              <Input type="url" value={editing?.url || ""} onChange={(e) => setEditing({ ...editing, url: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editing?.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input value={editing?.logo_url || ""} onChange={(e) => setEditing({ ...editing, logo_url: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={editing?.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={editing?.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <Label>Active</Label>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save Partner"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
