"use client";

/**
 * Adapted from KokonutUI's Bento Grid (https://kokonutui.com/docs/cards/bento-grid,
 * MIT licensed) — the original ships with placeholder AI-company demo content
 * (OpenAI/Anthropic logos, code snippets, a voice-assistant mock) and a 3D
 * tilt-on-hover effect. Kept the spotlight checklist, animated counters, and
 * timeline reveal; replaced all content with real Hbridge copy; dropped the
 * AI-specific pieces and the tilt effect in favor of flat, restrained cards
 * (Linear-style: let the content carry it, not hover gimmicks).
 */

import { ArrowUpRight, CheckCircle2, Sun, Moon } from "lucide-react";
import { motion, type Variants } from "motion/react";
import { useState } from "react";
import Link from "next/link";
import { RingChart } from "@/components/charts/ring-chart";
import { Ring } from "@/components/charts/ring";
import { RingCenter } from "@/components/charts/ring-center";
import { PROFESSIONS } from "@/lib/professions";

interface BentoItem {
  id: string;
  title: string;
  description: string;
  feature: "spotlight" | "professions" | "timeline" | "always-on" | "ring";
  spotlightItems?: string[];
  timeline?: Array<{ step: string; event: string }>;
  className?: string;
}

const bentoItems: BentoItem[] = [
  {
    id: "trust",
    title: "Verified, end to end",
    description:
      "Every layer of a Hbridge consultation is built to be trustworthy, not just convenient.",
    feature: "spotlight",
    spotlightItems: [
      "Practitioner licenses verified before they can see patients",
      "Medical records encrypted, access revocable anytime",
      "Secure in-app audio and video calling",
      "Real-time appointment and payment status",
    ],
    className: "md:col-span-2",
  },
  {
    id: "professions",
    title: `${PROFESSIONS.length} professions`,
    description: "Every regulated health profession currently supported on Hbridge.",
    feature: "professions",
    className: "md:col-span-1",
  },
  {
    id: "quick-consult",
    title: "How Quick Consultation works",
    description: "Skip scheduling — get matched to care right now.",
    feature: "timeline",
    timeline: [
      { step: "1", event: "Describe your symptoms" },
      { step: "2", event: "Matched with the next available practitioner" },
      { step: "3", event: "Consult by audio or video call" },
      { step: "4", event: "Notes and records saved to your history" },
    ],
    className: "md:col-span-1",
  },
  {
    id: "availability",
    title: "Always available",
    description: "Quick Consultation runs day and night — there's no closing time.",
    feature: "always-on",
    className: "md:col-span-1",
  },
  {
    id: "encrypted",
    title: "Records, fully encrypted",
    description: "Every medical record on Hbridge, end to end.",
    feature: "ring",
    className: "md:col-span-1",
  },
];

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const SpotlightFeature = ({ items }: { items: string[] }) => (
  <ul className="mt-3 space-y-2">
    {items.map((item, index) => (
      <motion.li
        animate={{ opacity: 1, x: 0 }}
        className="flex items-start gap-2"
        initial={{ opacity: 0, x: -10 }}
        key={item}
        transition={{ delay: 0.1 * index }}
      >
        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
        <span className="text-sm text-muted-foreground">{item}</span>
      </motion.li>
    ))}
  </ul>
);

const ProfessionsFeature = () => {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? PROFESSIONS : PROFESSIONS.slice(0, 6);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-1.5">
        {shown.map((p) => (
          <span
            key={p}
            className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
          >
            {p}
          </span>
        ))}
        {!expanded && PROFESSIONS.length > shown.length && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
          >
            +{PROFESSIONS.length - shown.length} more
          </button>
        )}
        {expanded && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
          >
            Show less
          </button>
        )}
      </div>
      <Link
        href="/community?type=suggestion"
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
      >
        Don&apos;t see yours? Suggest it
        <ArrowUpRight className="size-3" aria-hidden />
      </Link>
    </div>
  );
};

const AlwaysOnFeature = () => (
  <div className="mt-3">
    <div className="flex items-center gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Sun className="size-5 text-primary" aria-hidden />
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-primary/40 via-primary/20 to-primary/40" />
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Moon className="size-5 text-primary" aria-hidden />
      </div>
    </div>
    <p className="mt-3 text-center font-heading text-sm font-bold text-foreground">
      Day and night, every day of the week
    </p>
  </div>
);

const TimelineFeature = ({ timeline }: { timeline: Array<{ step: string; event: string }> }) => (
  <div className="relative mt-3">
    <div className="absolute top-0 bottom-0 left-[9px] w-px bg-border" />
    {timeline.map((item, index) => (
      <motion.div
        animate={{ opacity: 1, x: 0 }}
        className="relative mb-3 flex gap-3"
        initial={{ opacity: 0, x: -10 }}
        key={item.step}
        transition={{ delay: 0.1 * index }}
      >
        <div className="z-10 mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary/40 bg-background text-[10px] font-bold text-primary">
          {item.step}
        </div>
        <div className="text-sm text-muted-foreground">{item.event}</div>
      </motion.div>
    ))}
  </div>
);

const RingFeature = () => (
  <div className="mt-1 flex justify-center">
    <RingChart
      data={[{ label: "Encrypted", value: 100, maxValue: 100, color: "var(--chart-1)" }]}
      size={120}
      strokeWidth={14}
    >
      <Ring index={0} />
      <RingCenter defaultLabel="Encrypted" suffix="%" />
    </RingChart>
  </div>
);

const BentoCard = ({ item }: { item: BentoItem }) => {
  return (
    <motion.div className={`h-full ${item.className ?? ""}`} variants={fadeInUp}>
      <div className="group relative flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-5 transition-colors duration-200 hover:border-primary/30">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold text-foreground">
            {item.title}
          </h3>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <p className="text-sm text-muted-foreground">{item.description}</p>

        {item.feature === "spotlight" && item.spotlightItems && (
          <SpotlightFeature items={item.spotlightItems} />
        )}
        {item.feature === "professions" && <ProfessionsFeature />}
        {item.feature === "timeline" && item.timeline && (
          <TimelineFeature timeline={item.timeline} />
        )}
        {item.feature === "always-on" && <AlwaysOnFeature />}
        {item.feature === "ring" && <RingFeature />}
      </div>
    </motion.div>
  );
};

export default function BentoGrid() {
  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-6">
      <motion.div
        className="grid gap-6"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainer}
      >
        <div className="grid gap-6 md:grid-cols-3">
          <BentoCard item={bentoItems[0]} />
          <BentoCard item={bentoItems[1]} />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <BentoCard item={bentoItems[2]} />
          <BentoCard item={bentoItems[3]} />
          <BentoCard item={bentoItems[4]} />
        </div>
      </motion.div>
    </div>
  );
}
