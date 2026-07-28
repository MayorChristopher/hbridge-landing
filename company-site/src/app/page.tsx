import Image from "next/image";
import Link from "next/link";
import {
  Stethoscope,
  Building2,
  MessageCircle,
  ShieldCheck,
  FileText,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { HeroVisual } from "@/components/hero-visual";
import { PageShell } from "@/components/page-shell";
import { CommunityTeaser } from "@/components/community-teaser";
import { HowItWorks } from "@/components/how-it-works";

const STATS = [
  { value: "15", label: "Health professions supported" },
  { value: "24/7", label: "Quick Consultation availability" },
  { value: "100%", label: "Encrypted medical records" },
];

const AUDIENCES = [
  {
    icon: Stethoscope,
    title: "For Patients",
    description:
      "Book appointments, message your doctor, and keep every medical record in one secure place — or get matched to the next available practitioner in minutes.",
    href: "/product",
  },
  {
    icon: MessageCircle,
    title: "For Practitioners",
    description:
      "Manage your patient list, case files, and consultations from one dashboard. Join a hospital's network or practice independently — your choice.",
    href: "/practitioners",
  },
  {
    icon: Building2,
    title: "For Hospitals",
    description:
      "Bring your facility online: staff management, incoming patient records, and a verified presence patients and practitioners can find and trust.",
    href: "/hospitals",
  },
] as const;

const FEATURES = [
  {
    icon: Video,
    title: "In-app calling",
    description: "Secure audio and video consultations, built directly into the app.",
  },
  {
    icon: FileText,
    title: "Medical records",
    description: "Patients control who sees their records, and for how long.",
  },
  {
    icon: ShieldCheck,
    title: "Verified practitioners",
    description: "Every doctor's license is verified before they can see patients.",
  },
];

export default function Home() {
  return (
    <PageShell
      heroImage="/hero-bg.jpg"
      hero={
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8">
          <div>
            <Reveal>
              <h1 className="font-heading text-5xl font-extrabold tracking-tight text-white sm:text-7xl lg:text-8xl">
                Healthcare<br />for <span className="text-brand-gold">All</span>.
              </h1>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">
                Hbridge connects patients, doctors, and hospitals across Nigeria —
                so getting trusted medical care is as simple as opening an app.
              </p>
            </Reveal>
            <Reveal delay={0.16}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" className="bg-brand-gold text-brand-gold-foreground hover:bg-brand-gold/90" asChild>
                  <Link href="/download">Get Early Access</Link>
                </Button>
              </div>
            </Reveal>

            <RevealGroup className="mt-12 grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
              {STATS.map((stat) => (
                <RevealItem key={stat.label}>
                  <div className="font-heading text-2xl font-extrabold text-white sm:text-3xl">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-xs text-white/55 sm:text-sm">{stat.label}</div>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>

          <HeroVisual />
        </div>
      }
    >
      {/* Solution overview — three audiences, staggered rhythm instead of a uniform grid */}
      <section className="mx-auto max-w-6xl px-5 pt-16 pb-16 sm:px-6 sm:pt-24 sm:pb-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">
            One platform
          </p>
          <h2 className="font-heading mt-2 text-3xl font-bold text-foreground sm:text-4xl">
            Three sides of care
          </h2>
          <p className="mt-4 text-muted-foreground">
            Whichever side of the appointment you&apos;re on, Hbridge is built for you.
          </p>
        </Reveal>

        <RevealGroup className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {AUDIENCES.map((a) => (
            <RevealItem key={a.title} className="bg-card p-8">
              <a.icon className="size-6 text-foreground" aria-hidden />
              <h3 className="font-heading mt-4 text-xl font-semibold text-foreground">
                {a.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {a.description}
              </p>
              <Link
                href={a.href}
                className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
              >
                Learn more →
              </Link>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* How it works — dynamic, audience-switched onboarding flow */}
      <section className="bg-brand-ink">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold tracking-wide text-brand-gold uppercase">
              How it works
            </p>
            <h2 className="font-heading mt-2 text-3xl font-bold text-white sm:text-4xl">
              Set up in under 3 minutes
            </h2>
            <p className="mt-4 text-white/60">
              Pick your side of Hbridge to see exactly how it works for you.
            </p>
          </Reveal>

          <div className="mt-10">
            <HowItWorks />
          </div>
        </div>
      </section>

      {/* Feature highlights — real photography, not just app chrome */}
      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <Reveal>
              <h2 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
                Built for real care, not just booking
              </h2>
              <RevealGroup className="mt-8 flex flex-col gap-6">
                {FEATURES.map((f) => (
                  <RevealItem key={f.title} className="flex gap-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <f.icon className="size-5 text-primary" aria-hidden />
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-foreground">{f.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>
                    </div>
                  </RevealItem>
                ))}
              </RevealGroup>
            </Reveal>
            <Reveal delay={0.1} className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl">
              <Image
                src="https://images.pexels.com/photos/19957215/pexels-photo-19957215.jpeg?auto=compress&cs=tinysrgb&w=1200"
                alt="A Nigerian doctor conducting a video consultation on a smartphone and tablet, similar to Hbridge's in-app calling"
                width={1200}
                height={800}
                className="aspect-4/3 w-full object-cover"
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* Community teaser — real, live posts from visitors, not static testimonials */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">Community</p>
          <h2 className="font-heading mt-2 text-3xl font-bold text-foreground sm:text-4xl">
            Built with the people who&apos;ll use it
          </h2>
          <p className="mt-4 text-muted-foreground">
            Suggestions, questions, and thoughts from real visitors — shaping Hbridge as we build it.
          </p>
        </Reveal>

        <CommunityTeaser />

        <div className="mt-8 text-center">
          <Button variant="outline" asChild>
            <Link href="/community">Join the conversation</Link>
          </Button>
        </div>
      </section>
    </PageShell>
  );
}
