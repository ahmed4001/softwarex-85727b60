import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Link as LinkIcon, Unlink,
  Heading1, Heading2, Heading3, Quote, Code, Image as ImageIcon, Youtube as YoutubeIcon, Loader2,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { useCallback, useState } from "react";
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

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { HTMLAttributes: { class: "list-disc pl-4" } },
        orderedList: { HTMLAttributes: { class: "list-decimal pl-4" } },
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      Image.configure({ HTMLAttributes: { class: "rounded-lg my-4" } }),
      Youtube.configure({
        controls: true,
        nocookie: true,
        HTMLAttributes: { class: "w-full aspect-video rounded-lg my-4" },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "Start typing..." }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[120px] px-3 py-2 focus:outline-none text-foreground prose-headings:font-bold prose-img:rounded-lg",
      },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        handleFiles(files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files || []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        handleFiles(files);
        return true;
      },
    },
  });

  const handleFiles = useCallback(async (files: File[]) => {
    if (!editor) return;
    setUploading(true);
    try {
      for (const file of files) {
        const url = await uploadImage(file);
        const alt = window.prompt(`Alt text for ${file.name} (helps SEO):`, file.name.replace(/\.[^.]+$/, "")) || "";
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
    const url = window.prompt("URL", prev);
    if (url === null) return;
    if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
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

  const addYoutube = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("YouTube URL:");
    if (!url) return;
    editor.commands.setYoutubeVideo({ src: url, width: 640, height: 360 });
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={cn("rounded-xl border border-input bg-background overflow-hidden", className)}>
      <div className="flex flex-wrap gap-0.5 border-b border-input bg-muted/30 p-1 sticky top-0 z-10">
        <Toggle size="sm" pressed={editor.isActive("heading", { level: 1 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} aria-label="H1">
          <Heading1 className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("heading", { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="H2">
          <Heading2 className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("heading", { level: 3 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} aria-label="H3">
          <Heading3 className="h-4 w-4" />
        </Toggle>
        <div className="w-px bg-border mx-0.5 my-1" />
        <Toggle size="sm" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()} aria-label="Bold">
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic">
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()} aria-label="Underline">
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>
        <div className="w-px bg-border mx-0.5 my-1" />
        <Toggle size="sm" pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()} aria-label="Bullet list">
          <List className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("orderedList")} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Ordered list">
          <ListOrdered className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("blockquote")} onPressedChange={() => editor.chain().focus().toggleBlockquote().run()} aria-label="Quote">
          <Quote className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" pressed={editor.isActive("codeBlock")} onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()} aria-label="Code">
          <Code className="h-4 w-4" />
        </Toggle>
        <div className="w-px bg-border mx-0.5 my-1" />
        <Toggle size="sm" pressed={editor.isActive("link")} onPressedChange={setLink} aria-label="Link">
          {editor.isActive("link") ? <Unlink className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
        </Toggle>
        <Toggle size="sm" pressed={false} onPressedChange={addImage} aria-label="Image" disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
        </Toggle>
        <Toggle size="sm" pressed={false} onPressedChange={addYoutube} aria-label="YouTube">
          <YoutubeIcon className="h-4 w-4" />
        </Toggle>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
