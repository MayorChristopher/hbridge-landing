"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowBigUp,
  MessageCircle,
  Lightbulb,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
  Rows3,
  LayoutGrid,
  Flame,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import type { CommunityPost, CommunityPostType } from "@/lib/community";

const TABS: { value: "all" | CommunityPostType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "suggestion", label: "Suggestions" },
  { value: "question", label: "Questions" },
  { value: "comment", label: "Comments" },
];

const SORTS = [
  { value: "newest" as const, label: "Newest", icon: Clock },
  { value: "top" as const, label: "Top", icon: Flame },
];

const TYPE_META: Record<CommunityPostType, { icon: typeof Lightbulb; label: string; color: string }> = {
  suggestion: { icon: Lightbulb, label: "Suggestion", color: "text-brand-gold" },
  question: { icon: HelpCircle, label: "Question", color: "text-primary" },
  comment: { icon: MessageCircle, label: "Comment", color: "text-muted-foreground" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });
}

const UPVOTED_KEY = "hbridge_upvoted_posts";

function getUpvoted(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(UPVOTED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function PostCard({
  post,
  upvoted,
  onUpvote,
  compact,
}: {
  post: CommunityPost;
  upvoted: boolean;
  onUpvote: (id: string) => void;
  compact: boolean;
}) {
  const meta = TYPE_META[post.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`rounded-xl border border-border bg-card ${compact ? "p-3.5" : "p-5"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <meta.icon className={`mt-0.5 size-4 shrink-0 ${meta.color}`} aria-hidden />
          <div className="min-w-0">
            <p className={`leading-relaxed text-foreground ${compact ? "text-sm" : "text-sm"}`}>{post.content}</p>
            {!compact && (
              <p className="mt-2 text-xs text-muted-foreground">
                {post.name?.trim() || "Anonymous"} · {formatDate(post.created_at)}
              </p>
            )}
          </div>
        </div>

        {post.type === "suggestion" && (
          <button
            type="button"
            onClick={() => !upvoted && onUpvote(post.id)}
            disabled={upvoted}
            aria-label={upvoted ? "Already upvoted" : "Upvote this suggestion"}
            className={`flex shrink-0 flex-col items-center gap-0.5 rounded-lg border px-2.5 py-1.5 transition-colors ${
              upvoted
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
            }`}
          >
            <ArrowBigUp className="size-4" aria-hidden fill={upvoted ? "currentColor" : "none"} />
            <span className="text-xs font-bold">{post.upvotes}</span>
          </button>
        )}
      </div>

      {post.type === "question" && !compact && (
        <div className="mt-3 ml-6.5 rounded-lg bg-muted/60 p-3.5">
          {post.answer ? (
            <>
              <p className="text-xs font-semibold tracking-wide text-primary uppercase">Hbridge team</p>
              <p className="mt-1 text-sm leading-relaxed text-foreground">{post.answer}</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">Awaiting a reply from the Hbridge team.</p>
          )}
        </div>
      )}
    </motion.div>
  );
}

const VALID_TYPES: CommunityPostType[] = ["suggestion", "question", "comment"];

function CommunityForm({ onPosted }: { onPosted: (post: CommunityPost) => void }) {
  const searchParams = useSearchParams();
  const requestedType = searchParams.get("type");
  const initialType = VALID_TYPES.includes(requestedType as CommunityPostType)
    ? (requestedType as CommunityPostType)
    : "suggestion";

  const [type, setType] = useState<CommunityPostType>(initialType);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "live" | "pending" | "error">("idle");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setStatus("submitting");

    const { data, error } = await supabase
      .from("community_posts")
      .insert({ type, name: name.trim() || null, content: content.trim() })
      .select()
      .single();

    if (!error && data) {
      // Auto-moderation approved it instantly — readable back means it's live.
      setStatus("live");
      onPosted(data as CommunityPost);
      setContent("");
      setName("");
      return;
    }

    if (error?.code === "42501") {
      // Held for manual review by the moderation trigger — not readable yet.
      setStatus("pending");
      setContent("");
      setName("");
      return;
    }

    setStatus("error");
  };

  const placeholders: Record<CommunityPostType, string> = {
    suggestion: "What would make Hbridge better for you?",
    question: "What do you want to know about Hbridge?",
    comment: "Share a thought about Hbridge...",
  };

  if (status === "live" || status === "pending") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-8 text-center"
      >
        <CheckCircle2 className="size-8 text-primary" aria-hidden />
        <p className="font-heading font-semibold text-foreground">
          {status === "live" ? "You're live!" : "Got it — sent for a quick review"}
        </p>
        <p className="text-sm text-muted-foreground">
          {status === "live"
            ? "Your post passed our automatic check and is already showing in the feed."
            : "Our automatic check flagged this one for a human to look at first (links, short text, or flagged language do this). It'll appear here once approved."}
        </p>
        <Button variant="outline" size="sm" onClick={() => setStatus("idle")}>
          Post another
        </Button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
      <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-1">
        {(["suggestion", "question", "comment"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-md px-2 py-2 text-xs font-medium transition-colors sm:text-sm ${
              type === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {TYPE_META[t].label}
          </button>
        ))}
      </div>

      <Textarea
        placeholder={placeholders[type]}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={2000}
        required
      />
      <Input
        type="text"
        placeholder="Your name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      {status === "error" && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          Something went wrong. Please try again.
        </div>
      )}

      <Button
        type="submit"
        className="bg-brand-gold text-brand-gold-foreground hover:bg-brand-gold/90"
        disabled={status === "submitting" || !content.trim()}
      >
        {status === "submitting" ? "Checking…" : `Post ${TYPE_META[type].label.toLowerCase()}`}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Posts are checked automatically and usually appear right away.
      </p>
    </form>
  );
}

export function CommunityHub() {
  const [activeTab, setActiveTab] = useState<"all" | CommunityPostType>("all");
  const [sort, setSort] = useState<"newest" | "top">("newest");
  const [compact, setCompact] = useState(false);
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);
  const [counts, setCounts] = useState<Record<CommunityPostType, number> | null>(null);
  const [upvoted, setUpvoted] = useState<string[]>([]);

  useEffect(() => {
    setUpvoted(getUpvoted());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCounts() {
      const types: CommunityPostType[] = ["suggestion", "question", "comment"];
      const results = await Promise.all(
        types.map((t) => supabase.from("community_posts").select("id", { count: "exact", head: true }).eq("type", t))
      );
      if (cancelled) return;
      setCounts({
        suggestion: results[0].count ?? 0,
        question: results[1].count ?? 0,
        comment: results[2].count ?? 0,
      });
    }
    loadCounts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPosts(null);

    async function load() {
      let query = supabase
        .from("community_posts")
        .select("id, created_at, type, name, content, answer, answered_at, upvotes")
        .limit(50);

      query = sort === "top" ? query.order("upvotes", { ascending: false }).order("created_at", { ascending: false }) : query.order("created_at", { ascending: false });

      if (activeTab !== "all") {
        query = query.eq("type", activeTab);
      }

      const { data } = await query;
      if (!cancelled) setPosts(data ?? []);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, sort]);

  const handleUpvote = async (id: string) => {
    const next = [...upvoted, id];
    setUpvoted(next);
    window.localStorage.setItem(UPVOTED_KEY, JSON.stringify(next));
    setPosts((prev) => prev?.map((p) => (p.id === id ? { ...p, upvotes: p.upvotes + 1 } : p)) ?? prev);
    await supabase.rpc("increment_community_upvote", { post_id: id });
  };

  const handlePosted = (post: CommunityPost) => {
    setCounts((prev) => (prev ? { ...prev, [post.type]: prev[post.type] + 1 } : prev));
    if (activeTab !== "all" && activeTab !== post.type) return;
    setPosts((prev) => (prev ? [post, ...prev] : [post]));
  };

  const tabsWithCounts = useMemo(
    () =>
      TABS.map((t) => ({
        ...t,
        count: t.value === "all" ? null : (counts?.[t.value] ?? null),
      })),
    [counts]
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:items-start lg:gap-12">
      <div className="lg:sticky lg:top-24">
        <CommunityForm onPosted={handlePosted} />
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex flex-wrap gap-2">
            {tabsWithCounts.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {tab.count !== null && <span className="ml-1.5 opacity-70">{tab.count}</span>}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              {SORTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSort(s.value)}
                  aria-label={`Sort by ${s.label}`}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    sort === s.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <s.icon className="size-3.5" aria-hidden />
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setCompact(false)}
                aria-label="Comfortable view"
                className={`flex items-center rounded-md p-1.5 transition-colors ${
                  !compact ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setCompact(true)}
                aria-label="Compact view"
                className={`flex items-center rounded-md p-1.5 transition-colors ${
                  compact ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Rows3 className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>
        </div>

        <div className={`mt-6 flex flex-col ${compact ? "gap-2" : "gap-4"}`}>
          {posts === null && (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
          )}
          {posts !== null && posts.length === 0 && (
            <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              Nothing here yet — be the first to post.
            </div>
          )}
          <AnimatePresence initial={false}>
            {posts?.map((post) => (
              <PostCard key={post.id} post={post} upvoted={upvoted.includes(post.id)} onUpvote={handleUpvote} compact={compact} />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
