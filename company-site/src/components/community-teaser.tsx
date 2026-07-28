"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Lightbulb, HelpCircle, MessageCircle } from "lucide-react";

import { supabase } from "@/lib/supabase";
import type { CommunityPost, CommunityPostType } from "@/lib/community";

const TYPE_META: Record<CommunityPostType, { icon: typeof Lightbulb; color: string }> = {
  suggestion: { icon: Lightbulb, color: "text-brand-gold" },
  question: { icon: HelpCircle, color: "text-primary" },
  comment: { icon: MessageCircle, color: "text-muted-foreground" },
};

export function CommunityTeaser() {
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("community_posts")
        .select("id, created_at, type, name, content, answer, answered_at, upvotes")
        .order("created_at", { ascending: false })
        .limit(3);
      if (!cancelled) setPosts(data ?? []);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (posts !== null && posts.length === 0) return null;

  return (
    <div className="mt-14 grid gap-4 sm:grid-cols-3">
      {(posts ?? Array.from({ length: 3 })).map((post, i) => {
        if (!post) {
          return (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-muted/40" />
          );
        }
        const meta = TYPE_META[post.type];
        return (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <meta.icon className={`size-4 ${meta.color}`} aria-hidden />
            <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-foreground">{post.content}</p>
            <p className="mt-3 text-xs text-muted-foreground">{post.name?.trim() || "Anonymous"}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
