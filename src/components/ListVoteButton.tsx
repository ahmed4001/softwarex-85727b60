import { ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListVote } from "@/hooks/useListVote";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ListVoteButtonProps {
  listId: string;
  upvoteCount: number;
  size?: "sm" | "default";
}

export function ListVoteButton({ listId, upvoteCount, size = "default" }: ListVoteButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hasVoted, toggleVote, isToggling } = useListVote(listId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate("/login");
      return;
    }
    toggleVote();
  };

  return (
    <Button
      variant={hasVoted ? "default" : "outline"}
      size={size === "sm" ? "sm" : "default"}
      onClick={handleClick}
      disabled={isToggling}
      className={cn(
        "flex flex-col items-center gap-0 px-3",
        hasVoted && "bg-primary text-primary-foreground"
      )}
    >
      <ChevronUp className={cn("h-4 w-4", size === "sm" && "h-3 w-3")} />
      <span className={cn("text-xs font-bold", size === "sm" && "text-[10px]")}>
        {hasVoted ? upvoteCount + 1 : upvoteCount}
      </span>
    </Button>
  );
}
