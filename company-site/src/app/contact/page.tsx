import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = {
  title: "Contact — Hbridge",
  description: "Get in touch with the Hbridge team — support, hospital partnerships, or general inquiries.",
  alternates: { canonical: "/contact" },
};

const CONTACTS = [
  {
    title: "General & Support",
    description: "Questions about the app, your account, or anything else.",
  },
  {
    title: "Hospital Partnerships",
    description: "Interested in bringing your facility onto Hbridge? Reach out directly.",
  },
];

export default function ContactPage() {
  return (
    <PageShell
      hero={
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="inline-flex items-center rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-gold uppercase">
              Contact
            </span>
            <h1 className="font-heading mt-5 text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Get in touch
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-white/70">
              Whether you&apos;re a patient, a practitioner, or a hospital, we&apos;d like to
              hear from you.
            </p>
          </Reveal>
        </div>
      }
    >
      <section className="mx-auto max-w-4xl px-5 py-16 sm:px-6 sm:py-24">
        <RevealGroup className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          {CONTACTS.map((c) => (
            <RevealItem key={c.title} className="bg-card p-8">
              <h3 className="font-heading text-lg font-semibold text-foreground">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {c.description}
              </p>
              <Button className="mt-4 w-full" asChild>
                <Link href="mailto:hbridgenigeria@gmail.com">
                  <Mail className="size-4" aria-hidden />
                  hbridgenigeria@gmail.com
                </Link>
              </Button>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>
    </PageShell>
  );
}
