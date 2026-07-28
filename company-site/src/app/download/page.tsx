import type { Metadata } from "next";
import Image from "next/image";

import { WaitlistForm } from "@/components/waitlist-form";
import { Reveal } from "@/components/motion/reveal";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = {
  title: "Coming Soon — Hbridge",
  description: "Hbridge is putting the finishing touches on launch. Join the waitlist to be first in line.",
  alternates: { canonical: "/download" },
};

export default function DownloadPage() {
  return (
    <PageShell
      hero={
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <span className="inline-flex items-center rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-gold uppercase">
              Coming Soon
            </span>
            <h1 className="font-heading mt-5 text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Hbridge is almost here
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-white/70">
              We&apos;re putting the finishing touches on the app before launch. Join the
              waitlist and we&apos;ll notify you the moment it&apos;s available — whether
              you&apos;re a patient, a practitioner, or a hospital.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="mx-auto hidden w-full max-w-xs lg:block">
            <Image
              src="/mockup-records-iphone.png"
              alt="The Hbridge app's Medical Records screen, showing AES-256 encrypted, PIN-protected records"
              width={510}
              height={1012}
              className="w-full drop-shadow-2xl"
            />
          </Reveal>
        </div>
      }
    >
      <section className="mx-auto max-w-md px-5 py-16 sm:px-6 sm:py-20">
        <Reveal>
          <WaitlistForm />
        </Reveal>
      </section>
    </PageShell>
  );
}
