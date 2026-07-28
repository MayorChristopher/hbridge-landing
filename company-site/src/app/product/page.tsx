import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

import { FeatureRow } from "@/components/feature-row";
import { Reveal } from "@/components/motion/reveal";
import { PageShell } from "@/components/page-shell";
import BentoGrid from "@/components/kokonutui/bento-grid";

export const metadata: Metadata = {
  title: "Product — Hbridge",
  description: "See how Hbridge brings booking, messaging, calling, and medical records together in one app for patients and practitioners.",
  alternates: { canonical: "/product" },
};

export default function ProductPage() {
  return (
    <PageShell
      hero={
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="inline-flex items-center rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-gold uppercase">
              Product
            </span>
            <h1 className="font-heading mt-5 text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Everything care needs, in one app
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-white/70">
              Hbridge replaces the back-and-forth of phone calls and paper files with a
              single, secure app — built around how care actually happens.
            </p>
          </Reveal>
        </div>
      }
    >
      <section className="py-16 sm:py-20">
        <BentoGrid />
      </section>

      <FeatureRow
        id="booking"
        eyebrow="Booking"
        title="Book a consultation in a few taps"
        image="https://images.pexels.com/photos/19131214/pexels-photo-19131214.jpeg?auto=compress&cs=tinysrgb&w=1200"
        imageAlt="A smiling Nigerian doctor reviewing patient notes"
        variant="photo"
        tint
      >
        <ul className="flex flex-col gap-3">
          {[
            "Browse verified practitioners by specialty",
            "See real-time availability and consultation fees upfront",
            "Reschedule or cancel without calling anyone",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </FeatureRow>

      <FeatureRow
        id="quick-consultation"
        eyebrow="Quick Consultation"
        title="Or skip straight to the next available doctor"
        image="/mockup-explore-iphone.png"
        imageAlt="The Hbridge explore screen, showing a list of available doctors by specialty"
        reverse
      >
        <p>
          Not every visit needs a scheduled appointment. Describe your symptoms and
          Hbridge instantly matches you with the next available, verified practitioner
          — no picking a doctor required. Once they accept and payment is complete,
          you're straight into an audio or video consultation.
        </p>
      </FeatureRow>

      <FeatureRow
        id="messaging"
        eyebrow="Messaging & calling"
        title="Talk to your practitioner directly"
        image="https://images.pexels.com/photos/4350099/pexels-photo-4350099.jpeg?auto=compress&cs=tinysrgb&w=1200"
        imageAlt="A woman calmly messaging on her smartphone at home"
        variant="photo"
        tint
      >
        <p>
          Secure in-app messaging and calling means follow-up questions don&apos;t need a
          new appointment. Every conversation stays tied to your care history, not
          scattered across phone calls and texts.
        </p>
      </FeatureRow>

      <FeatureRow
        id="records"
        eyebrow="Medical records"
        title="Your records, under your control"
        image="/mockup-records-iphone.png"
        imageAlt="The Hbridge medical records screen, showing a patient's lab results and prescriptions"
        reverse
      >
        <p>
          Lab results, prescriptions, and visit summaries live in one encrypted place.
          You decide which practitioner or hospital can see them, and for how long —
          access can be revoked at any time.
        </p>
      </FeatureRow>
    </PageShell>
  );
}
