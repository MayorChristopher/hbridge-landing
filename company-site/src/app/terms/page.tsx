import type { Metadata } from "next";

import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = {
  title: "Terms of Service — Hbridge",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PageShell
      heroClassName="pb-14 sm:pb-16"
      hero={
        <h1 className="font-heading text-3xl font-bold text-white sm:text-4xl">
          Terms of Service
        </h1>
      }
    >
      <section className="mx-auto max-w-2xl px-5 py-16 text-center sm:px-6 sm:py-20">
        <p className="leading-relaxed text-muted-foreground">
          Hbridge provides medical information and connections for educational and
          care-coordination purposes. Our full terms are being finalized ahead of launch
          — if you have questions in the meantime, email{" "}
          <a href="mailto:hbridgenigeria@gmail.com" className="text-primary hover:underline">
            hbridgenigeria@gmail.com
          </a>
          .
        </p>
      </section>
    </PageShell>
  );
}
