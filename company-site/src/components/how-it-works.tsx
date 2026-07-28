"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  UserPlus,
  FolderPlus,
  HeartHandshake,
  ShieldCheck,
  Stethoscope,
  Users,
  Building2,
  Search,
} from "lucide-react";

type Audience = "patient" | "practitioner" | "hospital";

const AUDIENCE_TABS: { value: Audience; label: string }[] = [
  { value: "patient", label: "As a Patient" },
  { value: "practitioner", label: "As a Practitioner" },
  { value: "hospital", label: "As a Hospital" },
];

const FLOWS: Record<Audience, { icon: typeof UserPlus; title: string; description: string }[]> = {
  patient: [
    {
      icon: UserPlus,
      title: "Create your account",
      description: "Sign up with your email and add the basics of your health profile.",
    },
    {
      icon: Search,
      title: "Find your care",
      description: "Browse verified doctors by specialty, or use Quick Consultation to get matched instantly.",
    },
    {
      icon: HeartHandshake,
      title: "Book and connect",
      description: "Schedule a visit or start a call right away — your records stay attached to every visit.",
    },
  ],
  practitioner: [
    {
      icon: ShieldCheck,
      title: "Get verified",
      description: "Sign up and submit your license — most practitioners are verified within a day.",
    },
    {
      icon: Stethoscope,
      title: "Build your practice",
      description: "Set your specialty, consultation fees, and working days. You practice independently by default — link up with a hospital's network any time.",
    },
    {
      icon: HeartHandshake,
      title: "Start seeing patients",
      description: "Accept bookings, take Quick Consultations, and manage every case from one dashboard.",
    },
  ],
  hospital: [
    {
      icon: Building2,
      title: "Register your facility",
      description: "Add your hospital's type, category, and address to complete setup.",
    },
    {
      icon: Users,
      title: "Invite your staff",
      description: "Bring practitioners into your network and manage a verified roster.",
    },
    {
      icon: Search,
      title: "Go live",
      description: "Patients and practitioners can now find and connect with your facility directly.",
    },
  ],
};

export function HowItWorks() {
  const [audience, setAudience] = useState<Audience>("patient");
  const steps = FLOWS[audience];

  return (
    <div>
      <div className="mx-auto flex w-full max-w-md flex-wrap justify-center gap-2 rounded-full bg-white/10 p-1.5">
        {AUDIENCE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setAudience(tab.value)}
            className={`relative rounded-full px-4 py-2 text-xs font-medium transition-colors sm:text-sm ${
              audience === tab.value ? "text-brand-ink" : "text-white/70 hover:text-white"
            }`}
          >
            {audience === tab.value && (
              <motion.span
                layoutId="how-it-works-audience-pill"
                className="absolute inset-0 rounded-full bg-brand-gold"
                transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
              />
            )}
            <span className="relative">{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={audience}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="mt-14 grid gap-10 sm:grid-cols-3"
        >
          {steps.map((s, i) => (
            <div key={s.title} className="text-center">
              <div className="relative mx-auto flex size-14 items-center justify-center rounded-2xl bg-white/10">
                <s.icon className="size-6 text-brand-gold" aria-hidden />
                <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-brand-gold text-xs font-bold text-brand-gold-foreground">
                  {i + 1}
                </span>
              </div>
              <h3 className="font-heading mt-4 text-lg font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{s.description}</p>
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
