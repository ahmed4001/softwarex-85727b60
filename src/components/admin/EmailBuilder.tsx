import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Type, Image, MousePointerClick, Minus, MoveVertical,
  Trash2, GripVertical, Plus, Heading1, AlignLeft,
  Columns2, ArrowUp, ArrowDown, Code, Save, FolderOpen, Loader2, Upload, ImageIcon, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------- Block types ----------
type BlockType = "heading" | "text" | "button" | "image" | "divider" | "spacer" | "columns";

interface EmailBlock {
  id: string;
  type: BlockType;
  props: Record<string, string>;
}

const BLOCK_PALETTE: { type: BlockType; label: string; icon: React.ReactNode }[] = [
  { type: "heading", label: "Heading", icon: <Heading1 className="h-4 w-4" /> },
  { type: "text", label: "Text", icon: <AlignLeft className="h-4 w-4" /> },
  { type: "button", label: "Button", icon: <MousePointerClick className="h-4 w-4" /> },
  { type: "image", label: "Image", icon: <Image className="h-4 w-4" /> },
  { type: "divider", label: "Divider", icon: <Minus className="h-4 w-4" /> },
  { type: "spacer", label: "Spacer", icon: <MoveVertical className="h-4 w-4" /> },
  { type: "columns", label: "2 Columns", icon: <Columns2 className="h-4 w-4" /> },
];

const defaultProps = (type: BlockType): Record<string, string> => {
  switch (type) {
    case "heading": return { text: "Your Heading", level: "h1", color: "#111827", align: "left" };
    case "text": return { text: "Write your paragraph text here. You can add <strong>bold</strong> or <em>italic</em> text.", color: "#374151", align: "left", size: "14" };
    case "button": return { text: "Click Here →", url: "#", bgColor: "#4F46E5", textColor: "#ffffff", align: "center", radius: "8" };
    case "image": return { src: "https://placehold.co/560x200/e5e7eb/9ca3af?text=Your+Image", alt: "Image", width: "100" };
    case "divider": return { color: "#e5e7eb", thickness: "1" };
    case "spacer": return { height: "24" };
    case "columns": return { left: "Left column content", right: "Right column content", color: "#374151" };
    default: return {};
  }
};

let blockIdCounter = 0;
const genId = () => `block-${Date.now()}-${blockIdCounter++}`;

// ---------- Block → HTML ----------
function blockToHtml(block: EmailBlock): string {
  const { type, props: p } = block;
  switch (type) {
    case "heading": {
      const tag = p.level || "h1";
      const size = tag === "h1" ? "24" : tag === "h2" ? "20" : "16";
      return `<${tag} style="color:${p.color};font-size:${size}px;margin:0 0 8px;text-align:${p.align};font-family:Arial,sans-serif;">${p.text}</${tag}>`;
    }
    case "text":
      return `<p style="color:${p.color};font-size:${p.size}px;line-height:1.6;margin:0 0 16px;text-align:${p.align};font-family:Arial,sans-serif;">${p.text}</p>`;
    case "button":
      return `<div style="text-align:${p.align};margin:16px 0;"><a href="${p.url}" style="display:inline-block;background:${p.bgColor};color:${p.textColor};padding:12px 24px;border-radius:${p.radius}px;text-decoration:none;font-weight:600;font-size:14px;font-family:Arial,sans-serif;">${p.text}</a></div>`;
    case "image":
      return `<div style="text-align:center;margin:16px 0;"><img src="${p.src}" alt="${p.alt}" style="max-width:${p.width}%;height:auto;border-radius:4px;" /></div>`;
    case "divider":
      return `<hr style="border:none;border-top:${p.thickness}px solid ${p.color};margin:16px 0;" />`;
    case "spacer":
      return `<div style="height:${p.height}px;"></div>`;
    case "columns":
      return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr><td width="50%" valign="top" style="padding-right:8px;color:${p.color};font-size:14px;line-height:1.6;font-family:Arial,sans-serif;">${p.left}</td><td width="50%" valign="top" style="padding-left:8px;color:${p.color};font-size:14px;line-height:1.6;font-family:Arial,sans-serif;">${p.right}</td></tr></table>`;
    default:
      return "";
  }
}

function blocksToFullHtml(blocks: EmailBlock[], bgColor: string, contentBg: string): string {
  const inner = blocks.map(blockToHtml).join("\n    ");
  return `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;margin:0;padding:0;background:${bgColor};">
<div style="max-width:600px;margin:0 auto;padding:32px 24px;">
  <div style="background:${contentBg};border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
    ${inner}
  </div>
  <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">You're receiving this because you subscribed. <a href="#" style="color:#6b7280;">Unsubscribe</a></p>
</div>
</body></html>`;
}

// ---------- Block editor panel ----------
function BlockEditor({ block, onChange, onImageUpload, onOpenMediaLibrary }: {
  block: EmailBlock;
  onChange: (props: Record<string, string>) => void;
  onImageUpload?: (file: File) => Promise<string | null>;
  onOpenMediaLibrary?: (onSelect: (url: string) => void) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const { type, props: p } = block;
  const update = (key: string, val: string) => onChange({ ...p, [key]: val });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImageUpload) return;
    setUploading(true);
    try {
      const url = await onImageUpload(file);
      if (url) update("src", url);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  switch (type) {
    case "heading":
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Text</Label><Input value={p.text} onChange={(e) => update("text", e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Level</Label>
              <Select value={p.level} onValueChange={(v) => update("level", v)}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="h1">H1</SelectItem><SelectItem value="h2">H2</SelectItem><SelectItem value="h3">H3</SelectItem></SelectContent></Select>
            </div>
            <div><Label className="text-xs">Align</Label>
              <Select value={p.align} onValueChange={(v) => update("align", v)}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent></Select>
            </div>
            <div><Label className="text-xs">Color</Label><Input type="color" className="h-8 p-1" value={p.color} onChange={(e) => update("color", e.target.value)} /></div>
          </div>
        </div>
      );
    case "text":
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Content (HTML supported)</Label><Textarea className="min-h-[80px] text-xs" value={p.text} onChange={(e) => update("text", e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Size (px)</Label><Input type="number" className="h-8" value={p.size} onChange={(e) => update("size", e.target.value)} /></div>
            <div><Label className="text-xs">Align</Label>
              <Select value={p.align} onValueChange={(v) => update("align", v)}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent></Select>
            </div>
            <div><Label className="text-xs">Color</Label><Input type="color" className="h-8 p-1" value={p.color} onChange={(e) => update("color", e.target.value)} /></div>
          </div>
        </div>
      );
    case "button":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Label</Label><Input className="h-8" value={p.text} onChange={(e) => update("text", e.target.value)} /></div>
            <div><Label className="text-xs">URL</Label><Input className="h-8" value={p.url} onChange={(e) => update("url", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div><Label className="text-xs">BG</Label><Input type="color" className="h-8 p-1" value={p.bgColor} onChange={(e) => update("bgColor", e.target.value)} /></div>
            <div><Label className="text-xs">Text</Label><Input type="color" className="h-8 p-1" value={p.textColor} onChange={(e) => update("textColor", e.target.value)} /></div>
            <div><Label className="text-xs">Radius</Label><Input type="number" className="h-8" value={p.radius} onChange={(e) => update("radius", e.target.value)} /></div>
            <div><Label className="text-xs">Align</Label>
              <Select value={p.align} onValueChange={(v) => update("align", v)}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent></Select>
            </div>
          </div>
        </div>
      );
    case "image":
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Image</Label>
            <div className="flex gap-2 mt-1">
              <Input className="h-8 flex-1" placeholder="Image URL" value={p.src} onChange={(e) => update("src", e.target.value)} />
              <Button variant="outline" size="sm" className="h-8 gap-1 px-2 relative" disabled={uploading}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                <span className="text-xs">{uploading ? "..." : "Upload"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2"
                onClick={() => onOpenMediaLibrary?.((url) => update("src", url))}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span className="text-xs">Library</span>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Alt text</Label><Input className="h-8" value={p.alt} onChange={(e) => update("alt", e.target.value)} /></div>
            <div><Label className="text-xs">Width %</Label><Input type="number" className="h-8" value={p.width} onChange={(e) => update("width", e.target.value)} /></div>
          </div>
        </div>
      );
    case "divider":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Color</Label><Input type="color" className="h-8 p-1" value={p.color} onChange={(e) => update("color", e.target.value)} /></div>
          <div><Label className="text-xs">Thickness (px)</Label><Input type="number" className="h-8" value={p.thickness} onChange={(e) => update("thickness", e.target.value)} /></div>
        </div>
      );
    case "spacer":
      return (
        <div><Label className="text-xs">Height (px)</Label><Input type="number" className="h-8 w-24" value={p.height} onChange={(e) => update("height", e.target.value)} /></div>
      );
    case "columns":
      return (
        <div className="space-y-3">
          <div><Label className="text-xs">Left column (HTML)</Label><Textarea className="min-h-[60px] text-xs" value={p.left} onChange={(e) => update("left", e.target.value)} /></div>
          <div><Label className="text-xs">Right column (HTML)</Label><Textarea className="min-h-[60px] text-xs" value={p.right} onChange={(e) => update("right", e.target.value)} /></div>
          <div><Label className="text-xs">Text Color</Label><Input type="color" className="h-8 p-1 w-16" value={p.color} onChange={(e) => update("color", e.target.value)} /></div>
        </div>
      );
    default:
      return null;
  }
}

// ---------- Block preview (visual representation) ----------
function BlockPreview({ block }: { block: EmailBlock }) {
  const { type, props: p } = block;
  switch (type) {
    case "heading": {
      const sizes = { h1: "text-xl", h2: "text-lg", h3: "text-base" };
      return <div className={cn("font-bold", sizes[p.level as keyof typeof sizes] || "text-xl")} style={{ color: p.color, textAlign: p.align as any }}>{p.text}</div>;
    }
    case "text":
      return <p className="text-sm leading-relaxed" style={{ color: p.color, textAlign: p.align as any }} dangerouslySetInnerHTML={{ __html: p.text }} />;
    case "button":
      return (
        <div style={{ textAlign: p.align as any }}>
          <span className="inline-block px-4 py-2 rounded-md text-sm font-semibold" style={{ backgroundColor: p.bgColor, color: p.textColor, borderRadius: `${p.radius}px` }}>{p.text}</span>
        </div>
      );
    case "image":
      return <div className="text-center"><img src={p.src} alt={p.alt} className="max-w-full rounded" style={{ maxWidth: `${p.width}%` }} /></div>;
    case "divider":
      return <hr className="my-2" style={{ borderColor: p.color, borderWidth: `${p.thickness}px` }} />;
    case "spacer":
      return <div className="flex items-center justify-center text-[10px] text-muted-foreground" style={{ height: `${Math.min(Number(p.height), 48)}px` }}>↕ {p.height}px</div>;
    case "columns":
      return (
        <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: p.color }}>
          <div className="border border-dashed border-border rounded p-2" dangerouslySetInnerHTML={{ __html: p.left }} />
          <div className="border border-dashed border-border rounded p-2" dangerouslySetInnerHTML={{ __html: p.right }} />
        </div>
      );
    default:
      return null;
  }
}

// ---------- Main component ----------
interface EmailBuilderProps {
  value: string;
  onChange: (html: string) => void;
}

export function EmailBuilder({ value, onChange }: EmailBuilderProps) {
  const queryClient = useQueryClient();
  const [blocks, setBlocks] = useState<EmailBlock[]>(() => {
    if (!value || value.length < 30) {
      return [
        { id: genId(), type: "heading", props: defaultProps("heading") },
        { id: genId(), type: "text", props: defaultProps("text") },
        { id: genId(), type: "button", props: defaultProps("button") },
      ];
    }
    return [
      { id: genId(), type: "text", props: { ...defaultProps("text"), text: "Template loaded. Add or replace blocks below to customise your email." } },
    ];
  });

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [emailBg] = useState("#f9fafb");
  const [contentBg] = useState("#ffffff");

  // Save template state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");

  // Load template state
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);

  // Fetch saved templates
  const { data: savedTemplates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Save template mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("email_templates").insert({
        name: templateName,
        description: templateDesc || null,
        blocks: blocks as any,
        thumbnail_html: blocksToFullHtml(blocks, emailBg, contentBg).slice(0, 2000),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      setSaveDialogOpen(false);
      setTemplateName("");
      setTemplateDesc("");
      toast.success("Template saved!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template deleted");
    },
  });

  const loadTemplate = (templateBlocks: any[]) => {
    const loaded: EmailBlock[] = templateBlocks.map((b: any) => ({
      id: genId(),
      type: b.type,
      props: b.props,
    }));
    syncHtml(loaded);
    setLoadDialogOpen(false);
    setSelectedBlockId(null);
    toast.success("Template loaded");
  };

  const handleImageUpload = useCallback(async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "png";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("email-assets").upload(path, file, { contentType: file.type });
    if (error) {
      toast.error(`Upload failed: ${error.message}`);
      return null;
    }
    const { data: urlData } = supabase.storage.from("email-assets").getPublicUrl(path);
    toast.success("Image uploaded");
    return urlData.publicUrl;
  }, []);

  // Media library state
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [mediaSelectCallback, setMediaSelectCallback] = useState<((url: string) => void) | null>(null);
  const [mediaSearch, setMediaSearch] = useState("");

  // Fetch email-assets from storage + media_library table
  const { data: mediaItems = [], isLoading: mediaLoading, refetch: refetchMedia } = useQuery({
    queryKey: ["email-media-library"],
    queryFn: async () => {
      // Fetch from both sources in parallel
      const [storageRes, dbRes] = await Promise.all([
        supabase.storage.from("email-assets").list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } }),
        supabase.from("media_library").select("*").order("created_at", { ascending: false }).limit(100),
      ]);

      const items: { url: string; name: string; source: string; created_at: string }[] = [];

      // Storage items
      if (storageRes.data) {
        for (const f of storageRes.data) {
          if (f.name && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name)) {
            const { data: urlData } = supabase.storage.from("email-assets").getPublicUrl(f.name);
            items.push({ url: urlData.publicUrl, name: f.name, source: "email-assets", created_at: f.created_at || "" });
          }
        }
      }

      // Media library items
      if (dbRes.data) {
        for (const m of dbRes.data) {
          if (m.url && m.mime_type?.startsWith("image/")) {
            items.push({ url: m.url, name: m.original_name || m.filename, source: "media-library", created_at: m.created_at || "" });
          }
        }
      }

      return items;
    },
    enabled: mediaLibraryOpen,
  });

  const openMediaLibrary = useCallback((onSelect: (url: string) => void) => {
    setMediaSelectCallback(() => onSelect);
    setMediaLibraryOpen(true);
    refetchMedia();
  }, [refetchMedia]);

  const selectMediaItem = (url: string) => {
    mediaSelectCallback?.(url);
    setMediaLibraryOpen(false);
    setMediaSelectCallback(null);
  };

  const syncHtml = useCallback((newBlocks: EmailBlock[]) => {
    setBlocks(newBlocks);
    onChange(blocksToFullHtml(newBlocks, emailBg, contentBg));
  }, [onChange, emailBg, contentBg]);

  const addBlock = (type: BlockType) => {
    const newBlock: EmailBlock = { id: genId(), type, props: defaultProps(type) };
    const idx = selectedBlockId ? blocks.findIndex((b) => b.id === selectedBlockId) + 1 : blocks.length;
    const newBlocks = [...blocks];
    newBlocks.splice(idx, 0, newBlock);
    syncHtml(newBlocks);
    setSelectedBlockId(newBlock.id);
  };

  const updateBlockProps = (id: string, props: Record<string, string>) => {
    syncHtml(blocks.map((b) => (b.id === id ? { ...b, props } : b)));
  };

  const removeBlock = (id: string) => {
    syncHtml(blocks.filter((b) => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const newBlocks = [...blocks];
    [newBlocks[idx], newBlocks[newIdx]] = [newBlocks[newIdx], newBlocks[idx]];
    syncHtml(newBlocks);
  };

  // Drag and drop handlers
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const newBlocks = [...blocks];
    const [moved] = newBlocks.splice(dragIdx, 1);
    newBlocks.splice(idx, 0, moved);
    setBlocks(newBlocks);
    setDragIdx(idx);
  };
  const handleDragEnd = () => {
    setDragIdx(null);
    onChange(blocksToFullHtml(blocks, emailBg, contentBg));
  };

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);
  const blockIcon = (type: BlockType) => BLOCK_PALETTE.find((b) => b.type === type)?.icon;

  // Toggle raw HTML view
  if (showCode) {
    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-xs text-muted-foreground">Raw HTML Output</Label>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowCode(false)}>
            <Columns2 className="h-3 w-3" /> Visual Editor
          </Button>
        </div>
        <Textarea
          className="min-h-[300px] font-mono text-xs"
          value={blocksToFullHtml(blocks, emailBg, contentBg)}
          readOnly
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar: block palette */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs text-muted-foreground mr-1">Add:</span>
        {BLOCK_PALETTE.map((bp) => (
          <Button
            key={bp.type}
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 px-2"
            onClick={() => addBlock(bp.type)}
          >
            {bp.icon} {bp.label}
          </Button>
        ))}
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setLoadDialogOpen(true)}>
            <FolderOpen className="h-3 w-3" /> Load
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setTemplateName(""); setTemplateDesc(""); setSaveDialogOpen(true); }} disabled={blocks.length === 0}>
            <Save className="h-3 w-3" /> Save
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowCode(true)}>
            <Code className="h-3 w-3" /> HTML
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr,280px] gap-3 min-h-[350px]">
        {/* Canvas */}
        <div className="border rounded-xl bg-[#f9fafb] p-4 overflow-y-auto">
          <div className="max-w-[560px] mx-auto bg-white rounded-xl border border-border p-6 min-h-[280px] shadow-sm">
            {blocks.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <Plus className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Click a block above to start building</p>
              </div>
            )}
            {blocks.map((block, idx) => (
              <div
                key={block.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                onClick={() => setSelectedBlockId(block.id)}
                className={cn(
                  "group relative rounded-lg px-3 py-2 cursor-pointer transition-all border border-transparent",
                  selectedBlockId === block.id
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                    : "hover:border-border hover:bg-muted/20",
                  dragIdx === idx && "opacity-50"
                )}
              >
                {/* Drag handle + actions */}
                <div className={cn(
                  "absolute -left-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
                  selectedBlockId === block.id && "opacity-100"
                )}>
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
                </div>
                <div className={cn(
                  "absolute -right-1 top-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
                  selectedBlockId === block.id && "opacity-100"
                )}>
                  <button onClick={(e) => { e.stopPropagation(); moveBlock(idx, -1); }} className="h-5 w-5 flex items-center justify-center rounded bg-muted hover:bg-muted-foreground/20" disabled={idx === 0}>
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); moveBlock(idx, 1); }} className="h-5 w-5 flex items-center justify-center rounded bg-muted hover:bg-muted-foreground/20" disabled={idx === blocks.length - 1}>
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }} className="h-5 w-5 flex items-center justify-center rounded bg-destructive/10 hover:bg-destructive/20 text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                <BlockPreview block={block} />
              </div>
            ))}
          </div>
        </div>

        {/* Properties panel */}
        <div className="border rounded-xl bg-card p-3 overflow-y-auto">
          {selectedBlock ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                {blockIcon(selectedBlock.type)}
                <span className="text-sm font-medium capitalize">{selectedBlock.type}</span>
              </div>
              <BlockEditor
                block={selectedBlock}
                onChange={(props) => updateBlockProps(selectedBlock.id, props)}
                onImageUpload={handleImageUpload}
                onOpenMediaLibrary={openMediaLibrary}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center">
              <Type className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">Select a block to edit its properties</p>
            </div>
          )}
        </div>
      </div>

      {/* Save Template Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name</Label>
              <Input placeholder="e.g. Weekly Newsletter" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input placeholder="Brief description..." value={templateDesc} onChange={(e) => setTemplateDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!templateName.trim() || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Save className="h-4 w-4 mr-1" /> Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Template Dialog */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Load Saved Template</DialogTitle>
          </DialogHeader>
          {templatesLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : savedTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No saved templates yet. Build an email and save it as a template.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {savedTemplates.map((tpl) => (
                  <div key={tpl.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{tpl.name}</p>
                      {tpl.description && <p className="text-xs text-muted-foreground truncate">{tpl.description}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {(tpl.blocks as any[])?.length || 0} blocks · {new Date(tpl.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" className="h-7 text-xs" onClick={() => loadTemplate(tpl.blocks as any[])}>
                        Use
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => deleteMutation.mutate(tpl.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Media Library Dialog */}
      <Dialog open={mediaLibraryOpen} onOpenChange={(open) => { setMediaLibraryOpen(open); if (!open) setMediaSearch(""); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" /> Media Library
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search images by name..."
              value={mediaSearch}
              onChange={(e) => setMediaSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          {mediaLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (() => {
            const filtered = mediaItems.filter((item) =>
              item.name.toLowerCase().includes(mediaSearch.toLowerCase())
            );
            return filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{mediaSearch ? "No images match your search." : "No images found. Upload one using the Upload button in the image block."}</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="grid grid-cols-3 gap-3 p-1">
                  {filtered.map((item, i) => (
                    <button
                      key={`${item.source}-${i}`}
                      onClick={() => selectMediaItem(item.url)}
                      className="group relative rounded-lg border border-border overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all aspect-square bg-muted"
                    >
                      <img
                        src={item.url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-white truncate">{item.name}</p>
                        <p className="text-[9px] text-white/60">{item.source}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
