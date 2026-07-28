import type { Metadata } from "next";
import { Suspense } from "react";

import { Reveal } from "@/components/motion/reveal";
import { PageShell } from "@/components/page-shell";
import { CommunityHub } from "@/components/community-hub";

export const metadata: Metadata = {
  title: "Community — Hbridge",
  description: "Suggest a feature, ask a question, or share your thoughts on Hbridge — and see what other Nigerians are saying.",
  alternates: { canonical: "/community" },
};

export default function CommunityPage() {
  return (
    <PageShell
      hero={
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="inline-flex items-center rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-gold uppercase">
              Community
            </span>
            <h1 className="font-heading mt-5 text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Help shape Hbridge
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-white/70">
              Suggest what we should build next, ask us anything, or just tell us what
              you think. Posts are checked automatically and usually appear right away.
            </p>
          </Reveal>
        </div>
      }
    >
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <Suspense fallback={null}>
          <CommunityHub />
        </Suspense>
      </section>
    </PageShell>
  );
}
