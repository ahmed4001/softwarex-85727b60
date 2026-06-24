import { useEffect, useRef, useState } from "react";
import { useProductQA } from "@/hooks/useProductQA";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, MessageCircle, Send, Trash2, Store, ChevronDown, ChevronUp, Loader2, Sparkles, CheckCircle2, Link2, Check } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { trackEvent } from "@/lib/analytics";

// Derive `<slug>` from a `/product/<slug>` pathname for analytics tagging.
function getProductSlugFromPath(): string {
  if (typeof window === "undefined") return "";
  const m = window.location.pathname.match(/\/product\/([^/?#]+)/);
  return m?.[1] ?? "";
}

interface ProductQASectionProps {
  productId: string;
  isVendor?: boolean;
}

export function ProductQASection({ productId, isVendor }: ProductQASectionProps) {
  const { user } = useAuth();
  const { questions, answers, userVotes, isLoading, askQuestion, postAnswer, toggleVote, deleteQA } = useProductQA(productId);
  const [questionText, setQuestionText] = useState("");
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedQ, setExpandedQ] = useState<Set<string>>(new Set());
  // Snapshot the initial hash so we can distinguish a real deep-link arrival
  // (user landed with #qa-<id>) from later in-app updates (Copy link button
  // mutates the hash via replaceState).
  const initialHashRef = useRef<string>(
    typeof window !== "undefined" ? window.location.hash : ""
  );
  const deeplinkTrackedRef = useRef(false);

  // The hook orders questions by upvote_count desc, so questions[0] is the
  // same "top question" the .md QAPage JSON-LD picks. Auto-expand it (and
  // honour a deep link to #qa-<id>) so the accepted answer is visible by
  // default, matching what AI crawlers see in the JSON-LD block.
  const topQuestionId = questions[0]?.id as string | undefined;
  useEffect(() => {
    if (!topQuestionId) return;
    setExpandedQ((prev) => {
      if (prev.has(topQuestionId)) return prev;
      const next = new Set(prev);
      next.add(topQuestionId);
      return next;
    });
  }, [topQuestionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = initialHashRef.current;
    if (!hash?.startsWith("#qa-")) return;
    const id = hash.slice(4);
    setExpandedQ((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    // Defer scroll until the card has rendered.
    requestAnimationFrame(() => {
      document.getElementById(`qa-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    // Fire-once: outbound QA deep-link visit. Wait until questions resolved
    // so we know whether the anchored question is the top one.
    if (!deeplinkTrackedRef.current && questions.length > 0) {
      deeplinkTrackedRef.current = true;
      const referrer = typeof document !== "undefined" ? document.referrer || "" : "";
      let referrerHost = "";
      try {
        referrerHost = referrer ? new URL(referrer).hostname : "";
      } catch {
        /* noop */
      }
      const currentHost = window.location.hostname;
      const source = !referrer
        ? "direct"
        : referrerHost === currentHost
        ? "internal"
        : "external";
      trackEvent("qa_deeplink_visit", {
        product_slug: getProductSlugFromPath(),
        product_id: productId,
        question_id: id,
        is_top_question: id === questions[0]?.id,
        source,
        referrer_host: referrerHost,
      });
    }
  }, [questions.length, productId]);

  const toggleExpand = (id: string) => {
    setExpandedQ((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAsk = () => {
    if (!questionText.trim()) return;
    askQuestion.mutate(questionText);
    setQuestionText("");
  };

  const handleAnswer = (questionId: string) => {
    if (!answerText.trim()) return;
    postAnswer.mutate({ questionId, body: answerText, isVendor });
    setAnswerText("");
    setAnsweringId(null);
  };

  // Build a shareable URL using the same `#qa-<id>` anchor that the QAPage
  // JSON-LD references and that the hash-watcher above expands/scrolls to.
  const copyLink = async (questionId: string) => {
    const base =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}`
        : "";
    const link = `${base}#qa-${questionId}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const ta = document.createElement("textarea");
        ta.value = link;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      // Reflect the new hash so a reload from here also auto-expands/scrolls.
      if (typeof window !== "undefined" && window.history?.replaceState) {
        window.history.replaceState(null, "", `#qa-${questionId}`);
      }
      setCopiedId(questionId);
      toast.success("Link copied", {
        description: "Reopen it to jump straight to this question.",
      });
      setTimeout(() => setCopiedId((c) => (c === questionId ? null : c)), 1800);
    } catch {
      toast.error("Could not copy link", { description: link });
    }
  };

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading questions...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Ask a question */}
      <div className="glass-card p-6">
        <h3 className="font-display font-bold text-lg mb-4">Ask a Question</h3>
        {user ? (
          <div className="flex gap-3">
            <Textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="What would you like to know about this product?"
              rows={2}
              className="flex-1"
            />
            <Button
              onClick={handleAsk}
              disabled={askQuestion.isPending || !questionText.trim()}
              className="self-end gap-1.5"
            >
              {askQuestion.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Ask
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline">Sign in</Link> to ask a question.
          </p>
        )}
      </div>

      {/* Questions list */}
      {questions.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          No questions yet. Be the first to ask!
        </div>
      ) : (
        questions.map((q: any) => {
          const qAnswers = answers(q.id);
          const isExpanded = expandedQ.has(q.id);
          const hasVoted = userVotes.includes(q.id);
          const isTopQuestion = q.id === topQuestionId && qAnswers.length > 0;

          return (
            <div
              key={q.id}
              id={`qa-${q.id}`}
              className={cn(
                "glass-card p-6 space-y-4 scroll-mt-24",
                isTopQuestion && "ring-1 ring-primary/30"
              )}
            >
              {/* Question header */}
              <div className="flex items-start gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!user || toggleVote.isPending}
                  onClick={() => toggleVote.mutate(q.id)}
                  className={cn(
                    "flex-col h-auto py-2 px-2 rounded-xl gap-0.5",
                    hasVoted && "text-primary bg-primary/10"
                  )}
                >
                  <ThumbsUp className={cn("h-4 w-4", hasVoted && "fill-current")} />
                  <span className="text-xs font-bold">{q.upvote_count}</span>
                </Button>
                <div className="flex-1 min-w-0">
                  {isTopQuestion && (
                    <Badge
                      className="mb-2 bg-primary/10 text-primary border-0 text-[10px] px-2 py-0.5 gap-1"
                      title="Highest-voted question — featured in this page's QAPage structured data."
                    >
                      <Sparkles className="h-2.5 w-2.5" /> Top question
                    </Badge>
                  )}
                  <p className="text-foreground font-medium leading-relaxed">{q.body}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{q.profiles?.name || "User"}</span>
                    <span className="opacity-40">·</span>
                    <span>{formatDistanceToNow(new Date(q.created_at), { addSuffix: true })}</span>
                    {user?.id === q.user_id && (
                      <button onClick={() => deleteQA.mutate(q.id)} className="text-muted-foreground/40 hover:text-destructive transition-colors ml-1">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>


              {/* Answers toggle */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleExpand(q.id)}
                  className="text-xs gap-1.5 rounded-lg"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {qAnswers.length} {qAnswers.length === 1 ? "answer" : "answers"}
                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
                {user && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAnsweringId(answeringId === q.id ? null : q.id)}
                    className="text-xs rounded-lg"
                  >
                    Answer
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyLink(q.id)}
                  className="text-xs gap-1.5 rounded-lg ml-auto"
                  aria-label="Copy link to this question"
                  title="Copy link to this question"
                >
                  {copiedId === q.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-primary" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Link2 className="h-3.5 w-3.5" />
                      Copy link
                    </>
                  )}
                </Button>
              </div>

              {/* Answers list */}
              <AnimatePresence>
                {isExpanded && qAnswers.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-10 space-y-3 pt-2 border-t border-border/50">
                      {qAnswers.map((a: any, idx: number) => {
                        const aHasVoted = userVotes.includes(a.id);
                        // First answer = highest upvotes (hook ordering) =
                        // `acceptedAnswer` in the QAPage JSON-LD block.
                        const isAccepted = idx === 0;
                        return (
                          <div
                            key={a.id}
                            className={cn(
                              "flex items-start gap-3 py-2",
                              isAccepted && "rounded-xl bg-primary/5 px-3 -mx-3"
                            )}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!user || toggleVote.isPending}
                              onClick={() => toggleVote.mutate(a.id)}
                              className={cn(
                                "flex-col h-auto py-1 px-1.5 rounded-lg gap-0",
                                aHasVoted && "text-primary bg-primary/10"
                              )}
                            >
                              <ThumbsUp className={cn("h-3 w-3", aHasVoted && "fill-current")} />
                              <span className="text-[10px] font-bold">{a.upvote_count}</span>
                            </Button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                {isAccepted && (
                                  <Badge
                                    className="bg-primary/15 text-primary border-0 text-[10px] px-1.5 py-0 gap-0.5"
                                    title="Highest-voted answer — surfaced as acceptedAnswer in this page's QAPage JSON-LD."
                                  >
                                    <CheckCircle2 className="h-2.5 w-2.5" /> Accepted answer
                                  </Badge>
                                )}
                                <span className="text-xs font-semibold text-foreground">{a.profiles?.name || "User"}</span>
                                {a.is_vendor_answer && (
                                  <Badge className="bg-primary/10 text-primary border-0 text-[10px] px-1.5 py-0 gap-0.5">
                                    <Store className="h-2.5 w-2.5" /> Vendor
                                  </Badge>
                                )}
                                <span className="text-[10px] text-muted-foreground/50">
                                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                                </span>
                                {user?.id === a.user_id && (
                                  <button onClick={() => deleteQA.mutate(a.id)} className="text-muted-foreground/40 hover:text-destructive transition-colors">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed">{a.body}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Answer input */}
              {answeringId === q.id && user && (
                <div className="ml-10 flex gap-2">
                  <Textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Write your answer..."
                    rows={2}
                    className="flex-1 text-sm"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() => handleAnswer(q.id)}
                    disabled={postAnswer.isPending || !answerText.trim()}
                    className="self-end gap-1 px-3"
                  >
                    {postAnswer.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
