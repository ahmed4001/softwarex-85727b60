import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CharacterCount from "@tiptap/extension-character-count";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, ListChecks,
  Link as LinkIcon, Unlink, Heading1, Heading2, Heading3, Heading4, Quote, Code, Code2,
  Image as ImageIcon, Youtube as YoutubeIcon, Loader2, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Minus, Table as TableIcon, Highlighter, Palette, Undo2, Redo2, Eraser,
  SquareCode, Eye, Pilcrow, Subscript as SubIcon, Superscript as SupIcon, RemoveFormatting,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

async function uploadImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `blog/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

const TEXT_COLORS = [
  "#0f172a", "#475569", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

const HIGHLIGHT_COLORS = [
  "#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa",
  "#e9d5ff", "#fecaca", "#a5f3fc",
];

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<"rich" | "html" | "preview">("rich");
  const [htmlDraft, setHtmlDraft] = useState(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { HTMLAttributes: { class: "list-disc pl-6 my-3" } },
        orderedList: { HTMLAttributes: { class: "list-decimal pl-6 my-3" } },
        heading: { levels: [1, 2, 3, 4] },
        horizontalRule: { HTMLAttributes: { class: "my-6 border-border" } },
        // StarterKit v3 bundles link + underline — disable to avoid duplicate-extension warnings;
        // we re-register them below with custom HTMLAttributes.
        link: false,
        underline: false,
      } as any),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: "text-primary underline underline-offset-2", rel: "noopener noreferrer" },
      }),
      Image.configure({ HTMLAttributes: { class: "rounded-lg my-4 max-w-full h-auto" } }),
      Youtube.configure({
        controls: true,
        nocookie: true,
        HTMLAttributes: { class: "w-full aspect-video rounded-lg my-4" },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "Start typing, or press '/' for commands…" }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Table.configure({ resizable: true, HTMLAttributes: { class: "border-collapse table-auto w-full my-4" } }),
      TableRow,
      TableHeader.configure({ HTMLAttributes: { class: "border border-border bg-muted/50 px-3 py-2 font-semibold text-left" } }),
      TableCell.configure({ HTMLAttributes: { class: "border border-border px-3 py-2" } }),
      TaskList.configure({ HTMLAttributes: { class: "not-prose space-y-1 my-3" } }),
      TaskItem.configure({ nested: true, HTMLAttributes: { class: "flex gap-2 items-start" } }),
      Subscript,
      Superscript,
      CharacterCount,
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm md:prose-base max-w-none min-h-[400px] px-1 py-4 focus:outline-none text-foreground prose-headings:font-bold prose-img:rounded-lg prose-a:text-primary",
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        handleFiles(files);
        return true;
      },
      handleDrop: (_view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files || []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        handleFiles(files);
        return true;
      },
    },
  });

  // Sync external value changes (e.g. autosave reload) into the editor
  useEffect(() => {
    if (editor && value !== editor.getHTML() && mode === "rich") {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    if (mode !== "rich") setHtmlDraft(value);
  }, [value, editor, mode]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!editor) return;
    setUploading(true);
    try {
      for (const file of files) {
        const url = await uploadImage(file);
        const alt = window.prompt(`Alt text for ${file.name} (important for SEO):`, file.name.replace(/\.[^.]+$/, "")) || "";
        editor.chain().focus().setImage({ src: url, alt }).run();
      }
    } catch (err: any) {
      toast({ title: "Image upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("URL (use full https:// or /relative-path):", prev || "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    const isExternal = /^https?:\/\//i.test(url);
    editor.chain().focus().extendMarkRange("link").setLink({
      href: url,
      target: isExternal ? "_blank" : null,
      rel: isExternal ? "noopener noreferrer" : null,
    }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length) handleFiles(files);
    };
    input.click();
  }, [handleFiles]);

  const addImageUrl = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Image URL:");
    if (!url) return;
    const alt = window.prompt("Alt text (important for SEO):") || "";
    editor.chain().focus().setImage({ src: url, alt }).run();
  }, [editor]);

  const addYoutube = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("YouTube URL:");
    if (!url) return;
    editor.commands.setYoutubeVideo({ src: url, width: 640, height: 360 });
  }, [editor]);

  const insertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const applyHtml = useCallback(() => {
    if (!editor) return;
    editor.commands.setContent(htmlDraft || "", { emitUpdate: false });
    onChange(htmlDraft);
    setMode("rich");
    toast({ title: "HTML applied" });
  }, [editor, htmlDraft, onChange]);

  if (!editor) return null;

  const chars = editor.storage.characterCount?.characters?.() ?? 0;
  const words = editor.storage.characterCount?.words?.() ?? 0;

  return (
    <div className={cn("rounded-xl border border-input bg-background overflow-hidden flex flex-col", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-input bg-muted/30 p-1.5 sticky top-0 z-10">
        {/* Mode switcher */}
        <div className="flex items-center rounded-md border border-border bg-background mr-1">
          {([
            ["rich", Pilcrow, "Rich"],
            ["html", SquareCode, "HTML"],
            ["preview", Eye, "Preview"],
          ] as const).map(([m, Icon, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                // Leaving HTML mode — push the textarea draft into the editor & value
                if (mode === "html" && m !== "html") {
                  editor.commands.setContent(htmlDraft || "", { emitUpdate: false });
                  onChange(htmlDraft);
                }
                // Entering HTML mode — seed textarea with latest editor HTML
                if (m === "html" && mode !== "html") {
                  setHtmlDraft(editor.getHTML());
                }
                setMode(m);
              }}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors",
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              title={label}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        {mode === "rich" && (
          <>
            {/* Undo/Redo */}
            <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().undo().run()} aria-label="Undo" disabled={!editor.can().undo()}>
              <Undo2 className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().redo().run()} aria-label="Redo" disabled={!editor.can().redo()}>
              <Redo2 className="h-4 w-4" />
            </Toggle>
            <Sep />

            {/* Headings */}
            <Toggle size="sm" pressed={editor.isActive("heading", { level: 1 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} aria-label="H1">
              <Heading1 className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("heading", { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="H2">
              <Heading2 className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("heading", { level: 3 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} aria-label="H3">
              <Heading3 className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("heading", { level: 4 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} aria-label="H4">
              <Heading4 className="h-4 w-4" />
            </Toggle>
            <Sep />

            {/* Inline marks */}
            <Toggle size="sm" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()} aria-label="Bold">
              <Bold className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic">
              <Italic className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()} aria-label="Underline">
              <UnderlineIcon className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("strike")} onPressedChange={() => editor.chain().focus().toggleStrike().run()} aria-label="Strike">
              <Strikethrough className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("subscript")} onPressedChange={() => editor.chain().focus().toggleSubscript().run()} aria-label="Subscript">
              <SubIcon className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("superscript")} onPressedChange={() => editor.chain().focus().toggleSuperscript().run()} aria-label="Superscript">
              <SupIcon className="h-4 w-4" />
            </Toggle>
            <Sep />

            {/* Color & Highlight */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent" title="Text color">
                  <Palette className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <div className="grid grid-cols-5 gap-1">
                  {TEXT_COLORS.map((c) => (
                    <button key={c} onClick={() => editor.chain().focus().setColor(c).run()} className="h-6 w-6 rounded border border-border" style={{ backgroundColor: c }} aria-label={c} />
                  ))}
                  <button onClick={() => editor.chain().focus().unsetColor().run()} className="h-6 w-6 rounded border border-border bg-background flex items-center justify-center col-span-5 mt-1 text-[10px]">Clear</button>
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <button className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent" title="Highlight">
                  <Highlighter className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <div className="grid grid-cols-4 gap-1">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button key={c} onClick={() => editor.chain().focus().toggleHighlight({ color: c }).run()} className="h-6 w-6 rounded border border-border" style={{ backgroundColor: c }} aria-label={c} />
                  ))}
                  <button onClick={() => editor.chain().focus().unsetHighlight().run()} className="h-6 w-6 rounded border border-border bg-background flex items-center justify-center col-span-4 mt-1 text-[10px]">Clear</button>
                </div>
              </PopoverContent>
            </Popover>
            <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} aria-label="Clear formatting">
              <RemoveFormatting className="h-4 w-4" />
            </Toggle>
            <Sep />

            {/* Alignment */}
            <Toggle size="sm" pressed={editor.isActive({ textAlign: "left" })} onPressedChange={() => editor.chain().focus().setTextAlign("left").run()} aria-label="Align left">
              <AlignLeft className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive({ textAlign: "center" })} onPressedChange={() => editor.chain().focus().setTextAlign("center").run()} aria-label="Align center">
              <AlignCenter className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive({ textAlign: "right" })} onPressedChange={() => editor.chain().focus().setTextAlign("right").run()} aria-label="Align right">
              <AlignRight className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive({ textAlign: "justify" })} onPressedChange={() => editor.chain().focus().setTextAlign("justify").run()} aria-label="Justify">
              <AlignJustify className="h-4 w-4" />
            </Toggle>
            <Sep />

            {/* Lists & blocks */}
            <Toggle size="sm" pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()} aria-label="Bullet list">
              <List className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("orderedList")} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Numbered list">
              <ListOrdered className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("taskList")} onPressedChange={() => editor.chain().focus().toggleTaskList().run()} aria-label="Task list">
              <ListChecks className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("blockquote")} onPressedChange={() => editor.chain().focus().toggleBlockquote().run()} aria-label="Quote">
              <Quote className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("code")} onPressedChange={() => editor.chain().focus().toggleCode().run()} aria-label="Inline code">
              <Code className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("codeBlock")} onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()} aria-label="Code block">
              <Code2 className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().setHorizontalRule().run()} aria-label="Divider">
              <Minus className="h-4 w-4" />
            </Toggle>
            <Sep />

            {/* Media */}
            <Toggle size="sm" pressed={editor.isActive("link")} onPressedChange={setLink} aria-label="Link">
              {editor.isActive("link") ? <Unlink className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
            </Toggle>
            <Popover>
              <PopoverTrigger asChild>
                <button className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent" title="Image" disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1">
                <button onClick={addImage} className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent">Upload image…</button>
                <button onClick={addImageUrl} className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent">From URL…</button>
              </PopoverContent>
            </Popover>
            <Toggle size="sm" pressed={false} onPressedChange={addYoutube} aria-label="YouTube">
              <YoutubeIcon className="h-4 w-4" />
            </Toggle>
            <Toggle size="sm" pressed={false} onPressedChange={insertTable} aria-label="Table">
              <TableIcon className="h-4 w-4" />
            </Toggle>

            {editor.isActive("table") && (
              <>
                <Sep />
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="h-8 px-2 inline-flex items-center text-[11px] font-medium rounded-md hover:bg-accent">Table…</button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1 text-sm">
                    <MenuItem onClick={() => editor.chain().focus().addColumnBefore().run()}>Add column before</MenuItem>
                    <MenuItem onClick={() => editor.chain().focus().addColumnAfter().run()}>Add column after</MenuItem>
                    <MenuItem onClick={() => editor.chain().focus().deleteColumn().run()}>Delete column</MenuItem>
                    <div className="h-px bg-border my-1" />
                    <MenuItem onClick={() => editor.chain().focus().addRowBefore().run()}>Add row above</MenuItem>
                    <MenuItem onClick={() => editor.chain().focus().addRowAfter().run()}>Add row below</MenuItem>
                    <MenuItem onClick={() => editor.chain().focus().deleteRow().run()}>Delete row</MenuItem>
                    <div className="h-px bg-border my-1" />
                    <MenuItem onClick={() => editor.chain().focus().toggleHeaderRow().run()}>Toggle header row</MenuItem>
                    <MenuItem onClick={() => editor.chain().focus().mergeOrSplit().run()}>Merge / split</MenuItem>
                    <MenuItem onClick={() => editor.chain().focus().deleteTable().run()} danger>Delete table</MenuItem>
                  </PopoverContent>
                </Popover>
              </>
            )}
          </>
        )}

        {/* Right-side counter */}
        <div className="ml-auto flex items-center gap-2 px-2 text-[11px] text-muted-foreground">
          <span>{words} words</span>
          <span className="opacity-40">·</span>
          <span>{chars} chars</span>
        </div>
      </div>


      {/* Body */}
      {mode === "rich" && <EditorContent editor={editor} />}
      {mode === "html" && (
        <div className="flex flex-col">
          <textarea
            value={htmlDraft}
            onChange={(e) => setHtmlDraft(e.target.value)}
            spellCheck={false}
            className="w-full min-h-[420px] font-mono text-xs p-4 bg-muted/20 outline-none resize-y text-foreground"
            placeholder="<p>Raw HTML…</p>"
          />
          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Edit raw HTML. Apply to sync back to the visual editor.</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setMode("rich")}>Cancel</Button>
              <Button size="sm" className="h-7 text-xs" onClick={applyHtml}>Apply HTML</Button>
            </div>
          </div>
        </div>
      )}
      {mode === "preview" && (
        <div
          className="prose prose-sm md:prose-base max-w-none px-4 py-6 text-foreground"
          dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
        />
      )}
    </div>
  );
}

function Sep() {
  return <div className="w-px h-6 bg-border mx-0.5" />;
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-2 py-1.5 rounded hover:bg-accent text-sm",
        danger && "text-destructive hover:bg-destructive/10",
      )}
    >
      {children}
    </button>
  );
}
