import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, RefreshCw, Send, Trash2, Mail, Users, CreditCard, Eye, EyeOff, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface BrevoAccount {
  id: string;
  name: string;
  api_key: string;
  is_active: boolean;
  daily_credit_limit: number;
  credits_used_today: number;
  total_emails_sent: number;
  last_synced_at: string | null;
  created_at: string;
}

export default function AdminBrevoPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());
  const [newAccount, setNewAccount] = useState({ name: "", api_key: "", daily_credit_limit: 300 });
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["brevo-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brevo_accounts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as BrevoAccount[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (account: typeof newAccount) => {
      const { error } = await supabase.from("brevo_accounts").insert({
        name: account.name,
        api_key: account.api_key,
        daily_credit_limit: account.daily_credit_limit,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brevo-accounts"] });
      setAddOpen(false);
      setNewAccount({ name: "", api_key: "", daily_credit_limit: 300 });
      toast.success("Brevo account added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("brevo_accounts").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brevo-accounts"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("brevo_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brevo-accounts"] });
      setDeleteId(null);
      toast.success("Account deleted");
    },
  });

  const handleSync = async (accountId: string) => {
    setSyncingId(accountId);
    try {
      const { data, error } = await supabase.functions.invoke("brevo-api", {
        body: { action: "sync-contacts", accountId },
      });
      if (error) throw error;
      toast.success(`Synced ${data?.synced || 0} contacts to Brevo`);
      queryClient.invalidateQueries({ queryKey: ["brevo-accounts"] });
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    } finally {
      setSyncingId(null);
    }
  };

  const toggleKeyVisibility = (id: string) => {
    setShowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const maskKey = (key: string) => key.slice(0, 8) + "•".repeat(20) + key.slice(-4);

  const activeCount = accounts.filter((a) => a.is_active).length;
  const totalSent = accounts.reduce((s, a) => s + (a.total_emails_sent || 0), 0);
  const totalCreditsUsed = accounts.reduce((s, a) => s + (a.credits_used_today || 0), 0);
  const totalCreditLimit = accounts.reduce((s, a) => s + (a.daily_credit_limit || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Brevo Email Marketing</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage {accounts.length} Brevo account{accounts.length !== 1 ? "s" : ""} for email campaigns
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} disabled={accounts.length >= 5}>
          <Plus className="h-4 w-4 mr-2" /> Add Account
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{accounts.length}/5</p>
                <p className="text-xs text-muted-foreground">Accounts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                <Users className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                <Send className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalSent.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCreditsUsed}/{totalCreditLimit}</p>
                <p className="text-xs text-muted-foreground">Credits Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>Your Brevo API accounts and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No Brevo accounts yet. Add your first one to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Total Sent</TableHead>
                  <TableHead>Last Synced</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {showKeys.has(a.id) ? a.api_key : maskKey(a.api_key)}
                        </code>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleKeyVisibility(a.id)}>
                          {showKeys.has(a.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={a.is_active}
                          onCheckedChange={(checked) => toggleMutation.mutate({ id: a.id, is_active: checked })}
                        />
                        <Badge variant={a.is_active ? "default" : "secondary"}>
                          {a.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{a.credits_used_today}/{a.daily_credit_limit}</span>
                    </TableCell>
                    <TableCell>{(a.total_emails_sent || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.last_synced_at ? new Date(a.last_synced_at).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Sync contacts"
                          onClick={() => handleSync(a.id)}
                          disabled={syncingId === a.id}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${syncingId === a.id ? "animate-spin" : ""}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteId(a.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Account Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Brevo Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Account Name</Label>
              <Input
                placeholder="e.g. Main Account"
                value={newAccount.name}
                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
              />
            </div>
            <div>
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder="xkeysib-..."
                value={newAccount.api_key}
                onChange={(e) => setNewAccount({ ...newAccount, api_key: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Find it at <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noreferrer" className="underline">Brevo → Settings → API Keys</a>
              </p>
            </div>
            <div>
              <Label>Daily Credit Limit</Label>
              <Input
                type="number"
                value={newAccount.daily_credit_limit}
                onChange={(e) => setNewAccount({ ...newAccount, daily_credit_limit: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addMutation.mutate(newAccount)}
              disabled={!newAccount.name || !newAccount.api_key || addMutation.isPending}
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the Brevo account and all associated campaign history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
