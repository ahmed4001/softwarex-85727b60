import { useState } from "react";
import { SeoHead } from "@/components/SeoHead";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot, Sparkles, Send, Loader2, Copy, Wand2, FileText, MessageSquare,
  Star, Zap, Settings2, CheckCircle2, Key, Plus, Trash2, Eye, EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

const AI_MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", provider: "Google", speed: "Fast", badge: "Recommended" },
  { id: "google/gemini-3-pro-preview", label: "Gemini 3 Pro", provider: "Google", speed: "Medium" },
  { id: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image", provider: "Google", speed: "Medium", badge: "Image Gen" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google", speed: "Medium" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google", speed: "Fast" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", provider: "Google", speed: "Fastest" },
  { id: "openai/gpt-5", label: "GPT-5", provider: "OpenAI", speed: "Medium" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini", provider: "OpenAI", speed: "Fast" },
  { id: "openai/gpt-5-nano", label: "GPT-5 Nano", provider: "OpenAI", speed: "Fastest" },
  { id: "openai/gpt-5.2", label: "GPT-5.2", provider: "OpenAI", speed: "Medium", badge: "Latest" },
];

const EXTERNAL_PROVIDERS = [
  { id: "google_gemini", label: "Google Gemini API", secretKey: "GOOGLE_GEMINI_API_KEY", description: "Direct access to Google Gemini models", docsUrl: "https://ai.google.dev/gemini-api/docs/api-key" },
  { id: "openai", label: "OpenAI API", secretKey: "OPENAI_API_KEY", description: "Direct access to OpenAI GPT models", docsUrl: "https://platform.openai.com/api-keys" },
  { id: "anthropic", label: "Anthropic API", secretKey: "ANTHROPIC_API_KEY", description: "Access to Claude models", docsUrl: "https://console.anthropic.com/settings/keys" },
  { id: "mistral", label: "Mistral AI", secretKey: "MISTRAL_API_KEY", description: "Access to Mistral models", docsUrl: "https://console.mistral.ai/api-keys" },
  { id: "groq", label: "Groq", secretKey: "GROQ_API_KEY", description: "Ultra-fast inference for open models", docsUrl: "https://console.groq.com/keys" },
  { id: "perplexity", label: "Perplexity AI", secretKey: "PERPLEXITY_API_KEY", description: "AI-powered search and answers", docsUrl: "https://www.perplexity.ai/settings/api" },
];

const CONTENT_TEMPLATES = [
  { id: "product_description", label: "Product Description", icon: FileText, prompt: "Write a compelling product description for a software called '{name}'. Include key features, benefits, and target audience. Keep it professional and SEO-friendly." },
  { id: "review_summary", label: "Review Summary", icon: Star, prompt: "Summarize the following user reviews into a concise pros and cons summary:\n\n{content}" },
  { id: "blog_post", label: "Blog Post", icon: FileText, prompt: "Write a detailed blog post about '{topic}'. Include an engaging introduction, clear sections with headings, and a conclusion. Target 800-1200 words." },
  { id: "comparison", label: "Product Comparison", icon: MessageSquare, prompt: "Create a detailed comparison between {product_a} and {product_b}. Cover features, pricing, ease of use, support, and give a verdict." },
  { id: "seo_meta", label: "SEO Metadata", icon: Zap, prompt: "Generate SEO metadata for a page about '{topic}'. Include: title (max 60 chars), meta description (max 160 chars), and 5 relevant keywords." },
];

export default function AdminAIPage() {
  return (
    <>
      <SeoHead title="AI Integration - Admin" />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            AI Integration Hub
          </h1>
          <p className="text-muted-foreground mt-1">Configure AI providers, test prompts, and generate content</p>
        </div>

        <Tabs defaultValue="config" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="config" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" />Providers</TabsTrigger>
            <TabsTrigger value="playground" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" />Playground</TabsTrigger>
            <TabsTrigger value="generate" className="gap-1.5"><Wand2 className="h-3.5 w-3.5" />Generate</TabsTrigger>
          </TabsList>

          <TabsContent value="config"><ProvidersTab /></TabsContent>
          <TabsContent value="playground"><PlaygroundTab /></TabsContent>
          <TabsContent value="generate"><GenerateTab /></TabsContent>
        </Tabs>
      </div>
    </>
  );
}

/* ─── Providers Tab ─── */
function ProvidersTab() {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["ai-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*").eq("key", "ai_config").maybeSingle();
      return (data?.value as Record<string, unknown>) || { default_model: "google/gemini-3-flash-preview", temperature: 0.7 };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (config: Record<string, unknown>) => {
      const { error } = await supabase.from("site_settings").upsert({
        key: "ai_config",
        value: config as any,
        label: "AI Configuration",
        group: "ai",
      }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
      toast.success("AI configuration saved");
    },
    onError: () => toast.error("Failed to save configuration"),
  });

  const [selectedModel, setSelectedModel] = useState(
    (settings as any)?.default_model || "google/gemini-3-flash-preview"
  );

  const currentModel = AI_MODELS.find(m => m.id === selectedModel);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Default AI Model</CardTitle>
            <CardDescription>Choose the default model for all AI features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AI_MODELS.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2">
                      {m.label}
                      <span className="text-xs text-muted-foreground">({m.provider})</span>
                      {m.badge && <Badge variant="secondary" className="text-[10px] h-4">{m.badge}</Badge>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {currentModel && (
              <div className="p-3 rounded-xl bg-muted/50 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Provider</span><span className="font-medium">{currentModel.provider}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Speed</span><Badge variant="outline" className="text-xs">{currentModel.speed}</Badge></div>
              </div>
            )}

            <Button
              onClick={() => saveMutation.mutate({ ...((settings as any) || {}), default_model: selectedModel })}
              disabled={saveMutation.isPending}
              className="w-full"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Save Configuration
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Available Models</CardTitle>
            <CardDescription>All AI models accessible through Lovable AI</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {AI_MODELS.map(m => (
                <div key={m.id} className={cn(
                  "flex items-center justify-between p-3 rounded-xl border transition-colors",
                  m.id === selectedModel ? "border-primary/30 bg-primary/5" : "border-border/50"
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold",
                      m.provider === "Google" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"
                    )}>
                      {m.provider === "Google" ? "G" : "O"}
                    </div>
                    <div>
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        {m.label}
                        {m.badge && <Badge variant="secondary" className="text-[9px] h-4">{m.badge}</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.provider} • {m.speed}</p>
                    </div>
                  </div>
                  {m.id === selectedModel && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* External API Keys */}
      <ExternalApiKeysSection settings={settings} saveMutation={saveMutation} />
    </div>
  );
}

/* ─── External API Keys Section ─── */
function ExternalApiKeysSection({ settings, saveMutation }: { settings: any; saveMutation: any }) {
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [newKeys, setNewKeys] = useState<Record<string, string>>({});
  const [editingProvider, setEditingProvider] = useState<string | null>(null);

  const configuredKeys: Record<string, string> = (settings as any)?.api_keys || {};

  const toggleVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const saveKey = (provider: typeof EXTERNAL_PROVIDERS[number]) => {
    const key = newKeys[provider.id];
    if (!key?.trim()) return;
    const updatedKeys = { ...configuredKeys, [provider.id]: key.trim() };
    saveMutation.mutate({ ...((settings as any) || {}), api_keys: updatedKeys, default_model: (settings as any)?.default_model || "google/gemini-3-flash-preview" });
    setNewKeys(prev => ({ ...prev, [provider.id]: "" }));
    setEditingProvider(null);
    toast.success(`${provider.label} API key saved`);
  };

  const removeKey = (providerId: string) => {
    const updatedKeys = { ...configuredKeys };
    delete updatedKeys[providerId];
    saveMutation.mutate({ ...((settings as any) || {}), api_keys: updatedKeys, default_model: (settings as any)?.default_model || "google/gemini-3-flash-preview" });
    toast.success("API key removed");
  };

  const maskKey = (key: string) => key.slice(0, 8) + "•".repeat(Math.max(0, key.length - 12)) + key.slice(-4);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" />
          External API Keys
        </CardTitle>
        <CardDescription>
          Add your own API keys for direct model access. These are used as fallback when Lovable AI credits are exhausted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {EXTERNAL_PROVIDERS.map(provider => {
            const isConfigured = !!configuredKeys[provider.id];
            const isEditing = editingProvider === provider.id;
            const isVisible = visibleKeys.has(provider.id);

            return (
              <div key={provider.id} className={cn(
                "p-4 rounded-xl border transition-colors",
                isConfigured ? "border-primary/20 bg-primary/5" : "border-border/50"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center",
                      isConfigured ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <Key className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        {provider.label}
                        {isConfigured && <Badge variant="secondary" className="text-[9px] h-4">Configured</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">{provider.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isConfigured && !isEditing && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleVisibility(provider.id)}>
                          {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeKey(provider.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {!isEditing && (
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setEditingProvider(provider.id)}>
                        <Plus className="h-3 w-3" /> {isConfigured ? "Update" : "Add Key"}
                      </Button>
                    )}
                  </div>
                </div>

                {isConfigured && !isEditing && (
                  <div className="mt-2 px-12">
                    <code className="text-xs text-muted-foreground font-mono">
                      {isVisible ? configuredKeys[provider.id] : maskKey(configuredKeys[provider.id])}
                    </code>
                  </div>
                )}

                {isEditing && (
                  <div className="mt-3 flex gap-2">
                    <Input
                      type="password"
                      placeholder={`Paste your ${provider.label} key...`}
                      value={newKeys[provider.id] || ""}
                      onChange={e => setNewKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                      className="h-9 text-sm font-mono flex-1"
                    />
                    <Button size="sm" className="h-9" onClick={() => saveKey(provider)} disabled={!newKeys[provider.id]?.trim()}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" className="h-9" onClick={() => setEditingProvider(null)}>
                      Cancel
                    </Button>
                  </div>
                )}

                {isEditing && (
                  <p className="mt-2 text-xs text-muted-foreground px-1">
                    Get your key from{" "}
                    <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {provider.label} dashboard →
                    </a>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Playground Tab ─── */
function PlaygroundTab() {
  const [model, setModel] = useState("google/gemini-3-flash-preview");
  const [temperature, setTemperature] = useState([0.7]);
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful AI assistant.");
  const [userMessage, setUserMessage] = useState("");
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamEnabled, setStreamEnabled] = useState(true);

  const runPrompt = async () => {
    if (!userMessage.trim()) return;
    setResponse("");
    setIsStreaming(true);

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    try {
      if (streamEnabled) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-playground`;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages, model, temperature: temperature[0], stream: true }),
        });

        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || "Failed");
        }

        const reader = resp.body!.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let full = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, idx);
            buf = buf.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") break;
            try {
              const parsed = JSON.parse(json);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) { full += content; setResponse(full); }
            } catch { buf = line + "\n" + buf; break; }
          }
        }
      } else {
        const { data, error } = await supabase.functions.invoke("ai-playground", {
          body: { messages, model, temperature: temperature[0], stream: false },
        });
        if (error) throw error;
        setResponse(data.choices?.[0]?.message?.content || "No response");
      }
    } catch (err: any) {
      toast.error(err.message || "AI request failed");
      setResponse("");
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Prompt</CardTitle>
          <CardDescription>Configure and test AI prompts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map(m => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Temperature: {temperature[0]}</Label>
              <Slider value={temperature} onValueChange={setTemperature} min={0} max={2} step={0.1} className="mt-3" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Stream response</Label>
            <Switch checked={streamEnabled} onCheckedChange={setStreamEnabled} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">System Prompt</Label>
            <Textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={3} className="text-sm resize-none" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">User Message</Label>
            <Textarea value={userMessage} onChange={e => setUserMessage(e.target.value)} rows={4} placeholder="Enter your prompt here..." className="text-sm resize-none" />
          </div>

          <Button onClick={runPrompt} disabled={isStreaming || !userMessage.trim()} className="w-full gap-2">
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isStreaming ? "Generating..." : "Run Prompt"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Response</CardTitle>
            <CardDescription>{isStreaming ? "Streaming..." : response ? "Complete" : "Waiting for prompt"}</CardDescription>
          </div>
          {response && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(response); toast.success("Copied!"); }}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className={cn(
            "min-h-[300px] max-h-[500px] overflow-y-auto rounded-xl p-4 text-sm",
            response ? "bg-muted/30" : "bg-muted/10 flex items-center justify-center"
          )}>
            {response ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{response}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-muted-foreground/50 text-center">AI response will appear here</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Generate Tab ─── */
function GenerateTab() {
  const [template, setTemplate] = useState(CONTENT_TEMPLATES[0].id);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [model, setModel] = useState("google/gemini-3-flash-preview");

  const currentTemplate = CONTENT_TEMPLATES.find(t => t.id === template)!;

  const placeholders = currentTemplate.prompt.match(/\{(\w+)\}/g)?.map(p => p.slice(1, -1)) || [];

  const buildPrompt = () => {
    let p = currentTemplate.prompt;
    for (const [k, v] of Object.entries(inputs)) {
      p = p.replace(`{${k}}`, v);
    }
    return p;
  };

  const generate = async () => {
    setResult("");
    setIsGenerating(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-playground`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are a professional content writer for a software review platform. Write high-quality, SEO-optimized content." },
            { role: "user", content: buildPrompt() },
          ],
          model,
          temperature: 0.7,
          stream: true,
        }),
      });

      if (!resp.ok) throw new Error("Generation failed");

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) { full += content; setResult(full); }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Content Generator</CardTitle>
          <CardDescription>Generate content using AI templates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Template</Label>
              <Select value={template} onValueChange={(v) => { setTemplate(v); setInputs({}); setResult(""); }}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTENT_TEMPLATES.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map(m => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3">
            {placeholders.map(p => (
              <div key={p} className="space-y-1.5">
                <Label className="text-xs capitalize">{p.replace(/_/g, " ")}</Label>
                {p === "content" ? (
                  <Textarea value={inputs[p] || ""} onChange={e => setInputs(prev => ({ ...prev, [p]: e.target.value }))} rows={4} className="text-sm resize-none" placeholder={`Enter ${p.replace(/_/g, " ")}...`} />
                ) : (
                  <Input value={inputs[p] || ""} onChange={e => setInputs(prev => ({ ...prev, [p]: e.target.value }))} className="h-9 text-sm" placeholder={`Enter ${p.replace(/_/g, " ")}...`} />
                )}
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-muted/50">
            <p className="text-xs text-muted-foreground font-medium mb-1">Preview Prompt:</p>
            <p className="text-xs text-foreground/80 whitespace-pre-wrap">{buildPrompt()}</p>
          </div>

          <Button onClick={generate} disabled={isGenerating} className="w-full gap-2">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {isGenerating ? "Generating..." : "Generate Content"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Generated Content</CardTitle>
            <CardDescription>{isGenerating ? "Streaming..." : result ? "Complete" : "Select a template"}</CardDescription>
          </div>
          {result && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(result); toast.success("Copied!"); }}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className={cn(
            "min-h-[400px] max-h-[600px] overflow-y-auto rounded-xl p-4 text-sm",
            result ? "bg-muted/30" : "bg-muted/10 flex items-center justify-center"
          )}>
            {result ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-muted-foreground/50 text-center">Generated content will appear here</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
