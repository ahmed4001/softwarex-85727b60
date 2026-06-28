import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Image, Search, Trash2, Copy, ExternalLink, Upload, FileImage, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type MediaItem = {
  id: string;
  filename: string;
  original_name: string | null;
  url: string;
  thumbnail_url: string | null;
  file_type: string | null;
  file_size: number | null;
  mime_type: string | null;
  alt_text: string | null;
  caption: string | null;
  folder: string | null;
  created_at: string | null;
};

export default function AdminMediaPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: media = [], isLoading } = useQuery({
    queryKey: ["admin-media"],
    queryFn: async () => {
      const { data } = await supabase
        .from("media_library")
        .select("*")
        .order("created_at", { ascending: false });
      return (data || []) as MediaItem[];
    },
  });

  const filtered = search.trim()
    ? media.filter((m) =>
        (m.filename + (m.original_name || "") + (m.alt_text || ""))
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : media;

  const deleteMutation = useMutation({
    mutationFn: async (item: MediaItem) => {
      const { error } = await supabase.from("media_library").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      setDeleteTarget(null);
      toast.success("File deleted");
    },
    onError: () => toast.error("Failed to delete"),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filename, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filename);

        await supabase.from("media_library").insert({
          filename,
          original_name: file.name,
          url: urlData.publicUrl,
          mime_type: file.type,
          file_size: file.size,
          file_type: file.type.startsWith("image") ? "image" : "file",
          folder: "uploads",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      toast.success(`${files.length} file(s) uploaded`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copied");
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  return (
    <>
      <SeoHead title="Media Library - Admin" robots="noindex, nofollow" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Media Library</h1>
            <p className="text-muted-foreground">{media.length} files</p>
          </div>
          <div>
            <input type="file" id="media-upload" className="hidden" multiple accept="image/*" onChange={handleUpload} />
            <Button asChild className="gap-1.5" disabled={uploading}>
              <label htmlFor="media-upload" className="cursor-pointer">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload
              </label>
            </Button>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search files..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileImage className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No files found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="group relative aspect-square rounded-xl bg-muted overflow-hidden cursor-pointer border border-border hover:border-primary/40 transition-all"
                onClick={() => setPreviewItem(item)}
              >
                {item.mime_type?.startsWith("image") ? (
                  <img decoding="async" src={item.url} alt={item.alt_text || ""} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <FileImage className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-end">
                  <div className="p-2 w-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white truncate">{item.original_name || item.filename}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewItem} onOpenChange={(o) => !o && setPreviewItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="truncate">{previewItem?.original_name || previewItem?.filename}</DialogTitle>
          </DialogHeader>
          {previewItem && (
            <div className="space-y-4">
              {previewItem.mime_type?.startsWith("image") && (
                <div className="rounded-xl overflow-hidden bg-muted max-h-64 flex items-center justify-center">
                  <img decoding="async" loading="lazy" src={previewItem.url} alt="" className="max-h-64 object-contain" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Type:</span> <Badge variant="outline" className="text-[10px] ml-1">{previewItem.mime_type || "—"}</Badge></div>
                <div><span className="text-muted-foreground">Size:</span> {formatSize(previewItem.file_size)}</div>
                <div><span className="text-muted-foreground">Folder:</span> {previewItem.folder || "—"}</div>
                <div><span className="text-muted-foreground">Uploaded:</span> {previewItem.created_at ? formatDistanceToNow(new Date(previewItem.created_at), { addSuffix: true }) : "—"}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => copyUrl(previewItem.url)}>
                  <Copy className="h-3.5 w-3.5" /> Copy URL
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={previewItem.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> Open
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => { setPreviewItem(null); setDeleteTarget(previewItem); }}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteTarget?.original_name || deleteTarget?.filename}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
