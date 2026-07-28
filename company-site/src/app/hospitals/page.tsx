import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Users, FileInput, ShieldCheck, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = {
  title: "For Hospitals — Hbridge",
  description: "Bring your facility onto Hbridge: staff management, incoming patient records, and a verified presence patients and practitioners can find.",
  alternates: { canonical: "/hospitals" },
};

const CAPABILITIES = [
  {
    icon: Search,
    title: "Be discoverable",
    description:
      "Once your facility profile is complete, patients and practitioners can find and connect with you directly inside the app.",
  },
  {
    icon: Users,
    title: "Manage your staff",
    description:
      "Invite practitioners to your network, review pending requests, and keep an accurate, verified roster.",
  },
  {
    icon: FileInput,
    title: "Receive patient records",
    description:
      "Incoming records from patients and referring practitioners land in one organized queue, searchable by patient or folder number.",
  },
  {
    icon: ShieldCheck,
    title: "Verified, not generic",
    description:
      "Facilities complete a real setup step — type, category, and physical address — before they're discoverable, so patients only find real, findable hospitals.",
  },
];

export default function HospitalsPage() {
  return (
    <PageShell
      hero={
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8">
          <Reveal>
            <span className="inline-flex items-center rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-gold uppercase">
              For Hospitals
            </span>
            <h1 className="font-heading mt-5 text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Your facility, online and findable
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">
              Give your hospital a real, verified presence — where patients can find
              you and practitioners can join your network, all from one dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="bg-brand-gold text-brand-gold-foreground hover:bg-brand-gold/90" asChild>
                <Link href="/contact">Talk to Us</Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="mx-auto w-full max-w-md overflow-hidden rounded-2xl">
            <Image
              src="https://images.pexels.com/photos/8459996/pexels-photo-8459996.jpeg?auto=compress&cs=tinysrgb&w=1200"
              alt="A bright, modern hospital waiting room"
              width={1200}
              height={1000}
              className="aspect-4/5 w-full object-cover"
              priority
            />
          </Reveal>
        </div>
      }
    >
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <RevealGroup className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          {CAPABILITIES.map((c) => (
            <RevealItem key={c.title} className="bg-card p-8">
              <c.icon className="size-6 text-foreground" aria-hidden />
              <h3 className="font-heading mt-4 text-xl font-semibold text-foreground">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {c.description}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>
    </PageShell>
  );
}
