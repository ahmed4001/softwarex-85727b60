import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useSavedProducts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: savedProductIds = [], isLoading } = useQuery({
    queryKey: ["saved-products", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_products")
        .select("product_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data.map((sp) => sp.product_id);
    },
  });

  const toggleSave = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error("Must be logged in");
      const isSaved = savedProductIds.includes(productId);
      if (isSaved) {
        const { error } = await supabase
          .from("saved_products")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("saved_products")
          .insert({ user_id: user.id, product_id: productId });
        if (error) throw error;
      }
      return !isSaved;
    },
    onSuccess: (nowSaved) => {
      queryClient.invalidateQueries({ queryKey: ["saved-products"] });
      toast.success(nowSaved ? "Product saved!" : "Product removed from saved");
    },
    onError: () => toast.error("Failed to update saved products"),
  });

  return {
    savedProductIds,
    isLoading,
    isSaved: (productId: string) => savedProductIds.includes(productId),
    toggleSave: toggleSave.mutate,
    isToggling: toggleSave.isPending,
  };
}
