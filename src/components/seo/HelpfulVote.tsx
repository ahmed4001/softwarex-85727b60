import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface HelpfulVoteProps {
  /** Page path key, e.g. `/product/notion`. Defaults to current pathname. */
  pagePath?: string;
  className?: string;
}

function sessionId(): string {
  if (typeof window === "undefined") return "ssr";
  const k = "rh_session_id";
  let v = window.localStorage.getItem(k);
  if (!v) {
    v = crypto.randomUUID();
    window.localStorage.setItem(k, v);
  }
  return v;
}

function votedKey(path: string): string {
  return `rh_voted_${path}`;
}

/**
 * "Was this helpful?" widget. SXO signal: user-satisfaction proxy that
 * also feeds the admin SXO dashboard. Logged-out votes welcome.
 */
export function HelpfulVote({ pagePath, className }: HelpfulVoteProps) {
  const [path, setPath] = useState<string>(pagePath ?? "");
  const [voted, setVoted] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showFollowup, setShowFollowup] = useState(false);
  const [comment, setComment] = useState("");
  const [thanks, setThanks] = useState(false);
  const [stats, setStats] = useState<{ helpful_pct: number; total: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = pagePath ?? window.location.pathname;
    setPath(p);

    const prior = window.localStorage.getItem(votedKey(p));
    if (prior === "yes" || prior === "no") setVoted(prior === "yes");

    // Aggregate stats (public view)
    (async () => {
      const { data } = await (supabase
        .from("page_feedback_stats" as any)
        .select("helpful_pct, total_count")
        .eq("page_path", p)
        .maybeSingle() as any);
      if (data) setStats({ helpful_pct: Number(data.helpful_pct ?? 0), total: Number(data.total_count ?? 0) });
    })();
  }, [pagePath]);

  async function vote(isHelpful: boolean) {
    if (submitting || voted !== null) return;
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      await (supabase.from("page_feedback" as any) as any).insert({
        page_path: path,
        is_helpful: isHelpful,
        session_id: sessionId(),
        user_id: userData.user?.id ?? null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
      });
      window.localStorage.setItem(votedKey(path), isHelpful ? "yes" : "no");
      setVoted(isHelpful);
      if (!isHelpful) setShowFollowup(true);
      else setThanks(true);
    } catch (e) {
      console.warn("[helpful-vote] failed:", e);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitComment() {
    if (!comment.trim()) {
      setShowFollowup(false);
      setThanks(true);
      return;
    }
    try {
      await (supabase.from("page_feedback" as any) as any).insert({
        page_path: path,
        is_helpful: false,
        comment: comment.trim().slice(0, 1000),
        session_id: sessionId(),
      });
    } catch (e) {
      console.warn("[helpful-vote] comment failed:", e);
    }
    setShowFollowup(false);
    setThanks(true);
  }

  return (
    <section
      className={
        className ??
        "mt-10 border-t border-border pt-6 flex flex-col items-center text-center"
      }
      aria-label="Page feedback"
    >
      {thanks ? (
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Check className="h-4 w-4 text-primary" />
          Thanks for your feedback.
        </div>
      ) : showFollowup ? (
        <div className="w-full max-w-md space-y-2">
          <p className="text-sm font-medium">What was missing or wrong?</p>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional — helps us improve this page"
            rows={3}
            maxLength={1000}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setShowFollowup(false); setThanks(true); }}>
              Skip
            </Button>
            <Button size="sm" onClick={submitComment}>Send</Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm font-medium mb-3">Was this page helpful?</p>
          <div className="flex items-center gap-3">
            <Button
              variant={voted === true ? "default" : "outline"}
              size="sm"
              onClick={() => vote(true)}
              disabled={submitting || voted !== null}
              aria-label="Helpful"
            >
              <ThumbsUp className="h-4 w-4 mr-1.5" /> Yes
            </Button>
            <Button
              variant={voted === false ? "default" : "outline"}
              size="sm"
              onClick={() => vote(false)}
              disabled={submitting || voted !== null}
              aria-label="Not helpful"
            >
              <ThumbsDown className="h-4 w-4 mr-1.5" /> No
            </Button>
          </div>
          {stats && stats.total >= 3 && (
            <p className="text-xs text-muted-foreground mt-3">
              {stats.helpful_pct}% of {stats.total} readers found this helpful
            </p>
          )}
        </>
      )}
    </section>
  );
}
