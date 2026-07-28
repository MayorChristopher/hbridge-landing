import type { Metadata } from "next";
import { HeartPulse, Users, ShieldCheck, Globe } from "lucide-react";

import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = {
  title: "About — Hbridge",
  description: "Hbridge exists to make trusted healthcare reachable for every Nigerian, wherever they are.",
  alternates: { canonical: "/about" },
};

const VALUES = [
  {
    icon: HeartPulse,
    title: "Care first",
    description: "Every decision starts from what actually helps a patient get care faster and more safely.",
  },
  {
    icon: ShieldCheck,
    title: "Trust by design",
    description: "Verified practitioners, encrypted records, and patient-controlled access — not an afterthought.",
  },
  {
    icon: Users,
    title: "Built for everyone",
    description: "Fifteen regulated health professions, patients, and hospitals — one platform for the whole system.",
  },
  {
    icon: Globe,
    title: "Made for Nigeria",
    description: "Designed around how care actually works here — from Quick Consultations to hospital record-sharing.",
  },
];

export default function AboutPage() {
  return (
    <PageShell
      hero={
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="inline-flex items-center rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-gold uppercase">
              About
            </span>
            <h1 className="font-heading mt-5 text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Healthcare for All
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-white/70">
              Hbridge exists because getting trusted medical care in Nigeria shouldn&apos;t
              depend on who you know or how long you&apos;re willing to wait. We connect
              patients, practitioners, and hospitals on one platform — so care is a few
              taps away, not a whole day&apos;s errand.
            </p>
          </Reveal>
        </div>
      }
    >
      <section className="mx-auto max-w-3xl px-5 pt-16 sm:px-6 sm:pt-24">
        <Reveal className="text-center">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">
            Why we built this
          </p>
          <h2 className="font-heading mt-2 text-3xl font-bold text-foreground sm:text-4xl">
            We saw it firsthand in Nigeria&apos;s busiest hospitals
          </h2>
        </Reveal>
        <Reveal delay={0.08} className="mt-8 flex flex-col gap-5 text-left leading-relaxed text-muted-foreground">
          <p>
            In Nigeria&apos;s federal hospitals, patient attendance is high — and it shows.
            Creating a folder for every new patient, attending to each one, and keeping
            up with the sheer volume is a daily struggle for the staff running these
            facilities. When an emergency comes in, every minute spent searching for a
            file or waiting on an available doctor is a minute that matters.
          </p>
          <p>
            Practitioners are often stretched thin, and simply reaching one — for a
            consultation, a follow-up, or an urgent case — can be its own obstacle,
            separate from the medical problem itself. Even before that: finding the
            right hospital or the right doctor in the first place is rarely
            straightforward — there&apos;s no single, trusted place to see who&apos;s
            available, what they specialize in, or whether a facility can actually
            handle your case. And underneath all of it, medical records are still
            largely kept on paper: folders that get misplaced, notes that don&apos;t
            travel between departments, histories that have to be recreated because
            the original just can&apos;t be found.
          </p>
          <p>
            Hbridge exists because none of that should stand between a patient and
            care. We built one platform where patients can find and connect directly
            with verified hospitals and practitioners — so folders don&apos;t get
            lost, doctors are reachable and discoverable, and emergencies don&apos;t
            wait on paperwork.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <RevealGroup className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          {VALUES.map((v) => (
            <RevealItem key={v.title} className="bg-card p-8">
              <v.icon className="size-6 text-foreground" aria-hidden />
              <h3 className="font-heading mt-4 text-xl font-semibold text-foreground">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {v.description}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>
    </PageShell>
  );
}
