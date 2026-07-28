import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = {
  title: "Careers — Hbridge",
  description: "There are no open roles listed right now, but we'd like to hear from you.",
  alternates: { canonical: "/careers" },
};

export default function CareersPage() {
  return (
    <PageShell
      heroClassName="sm:pb-36"
      hero={
        <div className="mx-auto max-w-xl text-center">
          <Reveal>
            <span className="inline-flex items-center rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-gold uppercase">
              Careers
            </span>
            <h1 className="font-heading mt-5 text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Join us
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-white/70">
              We don&apos;t have specific roles open right now, but Hbridge is early and
              growing. If you care about making healthcare in Nigeria work better and want
              to be part of that, we&apos;d like to hear from you.
            </p>
            <div className="mt-8">
              <Button size="lg" className="bg-brand-gold text-brand-gold-foreground hover:bg-brand-gold/90" asChild>
                <Link href="mailto:hbridgenigeria@gmail.com">
                  <Mail className="size-4" aria-hidden />
                  Get in touch
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      }
    >
      <div className="h-8 sm:h-12" />
    </PageShell>
  );
}
