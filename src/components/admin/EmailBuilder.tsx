import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Type, Image, MousePointerClick, Minus, MoveVertical,
  Trash2, GripVertical, Plus, Heading1, AlignLeft,
  Columns2, ArrowUp, ArrowDown, Code,
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
function BlockEditor({ block, onChange }: { block: EmailBlock; onChange: (props: Record<string, string>) => void }) {
  const { type, props: p } = block;
  const update = (key: string, val: string) => onChange({ ...p, [key]: val });

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
          <div><Label className="text-xs">Image URL</Label><Input className="h-8" value={p.src} onChange={(e) => update("src", e.target.value)} /></div>
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
  const [blocks, setBlocks] = useState<EmailBlock[]>(() => {
    // Start with a sensible default if no content
    if (!value || value.length < 30) {
      const initial: EmailBlock[] = [
        { id: genId(), type: "heading", props: defaultProps("heading") },
        { id: genId(), type: "text", props: defaultProps("text") },
        { id: genId(), type: "button", props: defaultProps("button") },
      ];
      return initial;
    }
    // If value already exists (from template), start with a text block containing notice
    return [
      { id: genId(), type: "text", props: { ...defaultProps("text"), text: "Template loaded. Add or replace blocks below to customise your email." } },
    ];
  });

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [emailBg] = useState("#f9fafb");
  const [contentBg] = useState("#ffffff");

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
        <div className="ml-auto">
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
    </div>
  );
}
