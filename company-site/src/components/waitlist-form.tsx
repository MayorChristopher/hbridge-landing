"use client";

import { useEffect, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { PROFESSIONS } from "@/lib/professions";

type Role = "patient" | "practitioner" | "hospital";

const ROLES: { value: Role; label: string }[] = [
  { value: "patient", label: "I'm a Patient" },
  { value: "practitioner", label: "I'm a Practitioner" },
  { value: "hospital", label: "I'm a Hospital" },
];

type Status = "idle" | "submitting" | "success" | "duplicate" | "error";

function useWaitlistCounts() {
  const [counts, setCounts] = useState<{ patient: number; practitioner: number; hospital: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const roles: Role[] = ["patient", "practitioner", "hospital"];
      const results = await Promise.all(
        roles.map((role) =>
          supabase.from("waitlist").select("id", { count: "exact", head: true }).eq("role", role)
        )
      );
      if (cancelled) return;
      setCounts({
        patient: results[0].count ?? 0,
        practitioner: results[1].count ?? 0,
        hospital: results[2].count ?? 0,
      });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return counts;
}

function WaitlistMetrics() {
  const counts = useWaitlistCounts();
  if (!counts) return null;

  const items = [
    { label: "patients", value: counts.patient },
    { label: "practitioners", value: counts.practitioner },
    { label: "hospitals", value: counts.hospital },
  ];

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5"
        >
          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
          <span className="text-sm font-bold text-foreground">{item.value.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function WaitlistForm() {
  const [role, setRole] = useState<Role>("patient");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalState, setHospitalState] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("submitting");
    
  try{
    const { error } = await supabase.from("waitlist").insert({
      email: email.trim(),
      name: name.trim() || null,
      phone: phone.trim() || null,
      role,
      specialty: role === "practitioner" ? specialty || null : null,
      hospital_name: role === "hospital" ? hospitalName.trim() || null : null,
      hospital_state: role === "hospital" ? hospitalState.trim() || null : null,
    });

    if (!error) {
      setStatus("success");
      setEmail("");
      setName("");
      setPhone("");
      setSpecialty("");
      setHospitalName("");
      setHospitalState("");
      return;
    }

    // Postgres unique_violation on email
    setStatus(error.code === "23505" ? "duplicate" : "error");
  
} catch (error) {
    // Log network/connection failure for monitoring visibility
    console.error("Waitlist submission network error:", error);
    setStatus("error");
  }
};

  if (status === "success" || status === "duplicate") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-8 text-center"
      >
        <CheckCircle2 className="size-8 text-primary" aria-hidden />
        <p className="font-heading font-semibold text-foreground">
          {status === "success" ? "You're on the list!" : "You're already on the waitlist"}
        </p>
        <p className="text-sm text-muted-foreground">
          We&apos;ll be in touch before launch.
        </p>
      </motion.div>
    );
  }

  return (
    <div>
      <WaitlistMetrics />
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-1">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              className={`rounded-md px-2 py-2 text-xs font-medium transition-colors sm:text-sm ${
                role === r.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <Input
            type="email"
            placeholder="Email address *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            type="tel"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <AnimatePresence mode="wait">
            {role === "practitioner" && (
              <motion.div
                key="specialty"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="border-input h-11 w-full rounded-md border bg-transparent px-3.5 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
                >
                  <option value="">Select your profession</option>
                  {PROFESSIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </motion.div>
            )}
            {role === "hospital" && (
              <motion.div
                key="hospital"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-3"
              >
                <Input
                  type="text"
                  placeholder="Hospital name"
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                />
                <Input
                  type="text"
                  placeholder="State"
                  value={hospitalState}
                  onChange={(e) => setHospitalState(e.target.value)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {status === "error" && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            Something went wrong. Please try again.
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="bg-brand-gold text-brand-gold-foreground hover:bg-brand-gold/90"
          disabled={status === "submitting"}
        >
          {status === "submitting" ? "Joining…" : "Join the Waitlist"}
        </Button>
      </form>
    </div>
  );
}
