import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Send, FileText, Eye, Loader2, Plus, Clock, CheckCircle, XCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface BrevoAccount {
  id: string;
  name: string;
  is_active: boolean;
}

interface Campaign {
  id: string;
  brevo_account_id: string;
  brevo_campaign_id: string | null;
  subject: string;
  sender_name: string;
  sender_email: string;
  html_content: string | null;
  status: string;
  recipients_count: number;
  sent_at: string | null;
  created_at: string;
}

const EMAIL_TEMPLATES = [
  {
    id: "newsletter",
    name: "Newsletter",
    subject: "Weekly Software Insights",
    html: `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;margin:0;padding:0;background:#f9fafb;">
<div style="max-width:600px;margin:0 auto;padding:32px 24px;">
  <div style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
    <h1 style="color:#111827;font-size:24px;margin:0 0 8px;">📬 Weekly Insights</h1>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Your curated software news and reviews</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
    <h2 style="color:#111827;font-size:18px;margin:0 0 12px;">🔥 Trending This Week</h2>
    <p style="color:#374151;font-size:14px;line-height:1.6;">Write your content here...</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
    <a href="#" style="display:inline-block;background:#4F46E5;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Read More →</a>
  </div>
  <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">You're receiving this because you subscribed. <a href="#" style="color:#6b7280;">Unsubscribe</a></p>
</div>
</body></html>`,
  },
  {
    id: "product-launch",
    name: "Product Launch",
    subject: "New Product Alert 🚀",
    html: `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;margin:0;padding:0;background:#f9fafb;">
<div style="max-width:600px;margin:0 auto;padding:32px 24px;">
  <div style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="font-size:48px;">🚀</span>
    </div>
    <h1 style="color:#111827;font-size:28px;margin:0 0 12px;text-align:center;">New Product Alert</h1>
    <p style="color:#6b7280;font-size:16px;margin:0 0 24px;text-align:center;">We just added something special to our directory</p>
    <div style="background:#f3f4f6;border-radius:8px;padding:20px;margin:24px 0;">
      <h3 style="color:#111827;margin:0 0 8px;">Product Name</h3>
      <p style="color:#374151;font-size:14px;margin:0 0 16px;">Brief description of the product and what makes it special.</p>
      <a href="#" style="display:inline-block;background:#4F46E5;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">View Details</a>
    </div>
  </div>
</div>
</body></html>`,
  },
  {
    id: "promo",
    name: "Promotional",
    subject: "Don't Miss This Deal ⚡",
    html: `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;margin:0;padding:0;background:#f9fafb;">
<div style="max-width:600px;margin:0 auto;padding:32px 24px;">
  <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);border-radius:12px;padding:40px 32px;text-align:center;">
    <h1 style="color:#ffffff;font-size:32px;margin:0 0 12px;">⚡ Special Offer</h1>
    <p style="color:#e0e7ff;font-size:16px;margin:0 0 24px;">Limited time promotion for our subscribers</p>
    <a href="#" style="display:inline-block;background:#ffffff;color:#4F46E5;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">Claim Now</a>
  </div>
  <div style="background:#ffffff;border-radius:12px;padding:32px;margin-top:16px;border:1px solid #e5e7eb;">
    <p style="color:#374151;font-size:14px;line-height:1.6;">Write your promotional details here...</p>
  </div>
</div>
</body></html>`,
  },
  {
    id: "blank",
    name: "Blank",
    subject: "",
    html: `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;margin:0;padding:0;background:#f9fafb;">
<div style="max-width:600px;margin:0 auto;padding:32px 24px;">
  <div style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
    <p>Write your email content here...</p>
  </div>
</div>
</body></html>`,
  },
];

interface CampaignComposerProps {
  accounts: BrevoAccount[];
}

export function CampaignComposer({ accounts }: CampaignComposerProps) {
  const queryClient = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [editorTab, setEditorTab] = useState("compose");

  const [draft, setDraft] = useState({
    accountId: "",
    subject: "",
    senderName: "SoftwareHub",
    senderEmail: "",
    htmlContent: "",
    template: "",
  });

  const activeAccounts = accounts.filter((a) => a.is_active);

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ["brevo-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brevo_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Campaign[];
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("brevo_campaigns").insert({
        brevo_account_id: draft.accountId,
        subject: draft.subject,
        sender_name: draft.senderName,
        sender_email: draft.senderEmail,
        html_content: draft.htmlContent,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brevo-campaigns"] });
      toast.success("Draft saved");
      resetComposer();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("brevo-api", {
        body: {
          action: "send-campaign",
          accountId: draft.accountId,
          subject: draft.subject,
          senderName: draft.senderName,
          senderEmail: draft.senderEmail,
          htmlContent: draft.htmlContent,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brevo-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["brevo-accounts"] });
      toast.success("Campaign sent successfully!");
      resetComposer();
    },
    onError: (e: Error) => toast.error(`Send failed: ${e.message}`),
  });

  const resetComposer = () => {
    setComposerOpen(false);
    setConfirmSendOpen(false);
    setDraft({ accountId: "", subject: "", senderName: "SoftwareHub", senderEmail: "", htmlContent: "", template: "" });
    setEditorTab("compose");
  };

  const applyTemplate = (templateId: string) => {
    const tpl = EMAIL_TEMPLATES.find((t) => t.id === templateId);
    if (tpl) {
      setDraft((d) => ({
        ...d,
        template: templateId,
        subject: tpl.subject || d.subject,
        htmlContent: tpl.html,
      }));
      setEditorTab("compose");
    }
  };

  const isValid = draft.accountId && draft.subject && draft.senderEmail && draft.htmlContent;
  const selectedAccountName = accounts.find((a) => a.id === draft.accountId)?.name;

  const statusIcon = (status: string) => {
    switch (status) {
      case "sent": return <CheckCircle className="h-3.5 w-3.5 text-primary" />;
      case "draft": return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
      case "failed": return <XCircle className="h-3.5 w-3.5 text-destructive" />;
      default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <>
      {/* Campaign History & Compose Button */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Campaigns</CardTitle>
            <CardDescription>Email campaigns sent via Brevo</CardDescription>
          </div>
          <Button onClick={() => setComposerOpen(true)} disabled={activeAccounts.length === 0}>
            <Plus className="h-4 w-4 mr-2" /> New Campaign
          </Button>
        </CardHeader>
        <CardContent>
          {activeAccounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Send className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Add and activate a Brevo account to start sending campaigns.</p>
            </div>
          ) : campaignsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No campaigns yet. Create your first one!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusIcon(c.status)}
                        <Badge variant={c.status === "sent" ? "default" : "secondary"} className="capitalize">
                          {c.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{c.subject}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.sender_name} &lt;{c.sender_email}&gt;
                    </TableCell>
                    <TableCell className="text-sm">
                      {accounts.find((a) => a.id === c.brevo_account_id)?.name || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.sent_at
                        ? new Date(c.sent_at).toLocaleDateString()
                        : new Date(c.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Composer Dialog */}
      <Dialog open={composerOpen} onOpenChange={(open) => { if (!open) resetComposer(); else setComposerOpen(true); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Compose Campaign</DialogTitle>
          </DialogHeader>

          <Tabs value={editorTab} onValueChange={setEditorTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="template">Template</TabsTrigger>
              <TabsTrigger value="compose">Compose</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="template" className="space-y-3">
              <p className="text-sm text-muted-foreground">Choose a starting template for your email:</p>
              <div className="grid grid-cols-2 gap-3">
                {EMAIL_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl.id)}
                    className={`text-left p-4 rounded-xl border-2 transition-all hover:border-primary/50 hover:bg-muted/50 ${
                      draft.template === tpl.id ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <p className="font-semibold text-sm text-foreground">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tpl.id === "blank" ? "Start from scratch" : tpl.subject}
                    </p>
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="compose" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Brevo Account</Label>
                  <Select value={draft.accountId} onValueChange={(v) => setDraft({ ...draft, accountId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sender Email</Label>
                  <Input
                    placeholder="noreply@yourdomain.com"
                    value={draft.senderEmail}
                    onChange={(e) => setDraft({ ...draft, senderEmail: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Sender Name</Label>
                  <Input
                    value={draft.senderName}
                    onChange={(e) => setDraft({ ...draft, senderName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Subject Line</Label>
                  <Input
                    placeholder="Your email subject"
                    value={draft.subject}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>HTML Content</Label>
                <Textarea
                  className="min-h-[300px] font-mono text-xs"
                  placeholder="Paste or write your HTML email content..."
                  value={draft.htmlContent}
                  onChange={(e) => setDraft({ ...draft, htmlContent: e.target.value })}
                />
              </div>
            </TabsContent>

            <TabsContent value="preview">
              {draft.htmlContent ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground border rounded-lg p-3 bg-muted/30">
                    <span><strong>From:</strong> {draft.senderName} &lt;{draft.senderEmail}&gt;</span>
                    <span><strong>Subject:</strong> {draft.subject || "(no subject)"}</span>
                  </div>
                  <div className="border rounded-xl overflow-hidden bg-background">
                    <iframe
                      srcDoc={draft.htmlContent}
                      className="w-full h-[400px] border-0"
                      title="Email Preview"
                      sandbox=""
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Eye className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Write some content first to preview it here.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={resetComposer}>Cancel</Button>
            <Button
              variant="secondary"
              onClick={() => saveDraftMutation.mutate()}
              disabled={!draft.accountId || !draft.subject || saveDraftMutation.isPending}
            >
              {saveDraftMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Draft
            </Button>
            <Button
              onClick={() => setConfirmSendOpen(true)}
              disabled={!isValid || sendMutation.isPending}
            >
              {sendMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Send className="h-4 w-4 mr-2" /> Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Confirmation */}
      <AlertDialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send "<strong>{draft.subject}</strong>" from {draft.senderName} &lt;{draft.senderEmail}&gt;
              via <strong>{selectedAccountName}</strong> to all contacts in the default list. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => sendMutation.mutate()}>
              Send Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
