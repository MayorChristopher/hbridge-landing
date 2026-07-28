"use client";

import Image from "next/image";
import { motion } from "motion/react";

/**
 * Hero app screenshot — presented grounded and real, not as a floating
 * marketing graphic. Following Linear's approach: show the actual product,
 * let it carry the credibility, skip the glow/float decoration that makes a
 * screenshot look like an illustration of an app rather than the app itself.
 */
export function HeroVisual() {
  return (
    <motion.div
      className="relative mx-auto w-full max-w-xs lg:max-w-sm"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <Image
        src="/mockup-home-android-portrait.png"
        alt="The Hbridge app home screen, showing upcoming appointments and quick actions"
        width={420}
        height={860}
        priority
        className="w-full drop-shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
      />
    </motion.div>
  );
}
