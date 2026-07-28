import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarClock, Users, FolderOpen, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = {
  title: "For Practitioners — Hbridge",
  description: "Manage appointments, patients, case files, and hospital affiliations from one dashboard built for Nigerian health professionals.",
  alternates: { canonical: "/practitioners" },
};

const CAPABILITIES = [
  {
    icon: CalendarClock,
    title: "Appointments, on your terms",
    description:
      "Set your availability, approve or reschedule requests, and take Quick Consultation calls when you have time between bookings.",
  },
  {
    icon: Users,
    title: "One patient list, fully organized",
    description:
      "Every patient you've seen, grouped and searchable — with their consultation history and shared records in one place.",
  },
  {
    icon: FolderOpen,
    title: "Case files that travel with the patient",
    description:
      "Request, review, and send medical records with expiring, revocable access — no more chasing paper files.",
  },
  {
    icon: Building2,
    title: "Join a hospital, or practice independently",
    description:
      "Link your profile to a verified hospital's network, or build your own patient base directly through Hbridge.",
  },
];

export default function PractitionersPage() {
  return (
    <PageShell
      hero={
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8">
          <Reveal>
            <span className="inline-flex items-center rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-gold uppercase">
              For Practitioners
            </span>
            <h1 className="font-heading mt-5 text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Your practice, organized
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">
              Every regulated health profession in Nigeria — doctors, nurses,
              pharmacists, and more — can build a verified practice on Hbridge, with
              real patients finding and booking you directly.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="bg-brand-gold text-brand-gold-foreground hover:bg-brand-gold/90" asChild>
                <Link href="/download">Get Early Access</Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="mx-auto w-full max-w-md overflow-hidden rounded-2xl">
            <Image
              src="https://images.pexels.com/photos/19596247/pexels-photo-19596247.jpeg?auto=compress&cs=tinysrgb&w=1200"
              alt="A smiling Nigerian doctor in a white coat and stethoscope, representing the practitioners who use Hbridge"
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
