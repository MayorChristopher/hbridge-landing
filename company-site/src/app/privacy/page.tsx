import type { Metadata } from "next";

import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — Hbridge",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <PageShell
      heroClassName="pb-14 sm:pb-16"
      hero={
        <h1 className="font-heading text-3xl font-bold text-white sm:text-4xl">
          Privacy Policy
        </h1>
      }
    >
      <section className="mx-auto max-w-2xl px-5 py-16 text-center sm:px-6 sm:py-20">
        <p className="leading-relaxed text-muted-foreground">
          Hbridge encrypts all medical data and never shares personal information with
          third parties. Our full privacy policy is being finalized ahead of launch — if
          you have questions in the meantime, email{" "}
          <a href="mailto:hbridgenigeria@gmail.com" className="text-primary hover:underline">
            hbridgenigeria@gmail.com
          </a>
          .
        </p>
      </section>
    </PageShell>
  );
}
