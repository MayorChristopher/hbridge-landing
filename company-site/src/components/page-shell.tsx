import Image from "next/image";
import type { ReactNode } from "react";

/**
 * The app's signature chrome, brought to web: a dark-teal hero band with a
 * warm off-white "paper" card tucked underneath it (rounded top corners,
 * slight overlap) — the exact motif every screen in the RN app uses
 * (DoctorHomeScreen, HospitalHomeScreen, SignUpScreen, etc.). Without this,
 * the site reads as a generic template; with it, every page reads as
 * unmistakably Hbridge.
 *
 * Deliberately no decorative background elements here (no floating shapes,
 * no gradients) — following Linear's restraint principle: typography and the
 * real product carry the page, not marketing-site decoration. heroImage is
 * the one exception: a real photo at low opacity, darkened, as quiet texture
 * behind the text — not a competing visual.
 */
export function PageShell({
  hero,
  children,
  heroClassName,
  heroImage,
}: {
  hero: ReactNode;
  children: ReactNode;
  heroClassName?: string;
  heroImage?: string;
}) {
  return (
    <>
      <div className={`relative overflow-hidden bg-brand-ink px-5 pt-24 pb-20 sm:px-6 sm:pt-28 sm:pb-28 ${heroClassName ?? ""}`}>
        {heroImage && (
          <>
            <Image
              src={heroImage}
              alt=""
              aria-hidden
              fill
              priority
              className="object-cover opacity-[0.14] brightness-50 saturate-50"
            />
            <div className="absolute inset-0 bg-brand-ink/40" />
          </>
        )}
        <div className="relative mx-auto max-w-6xl">{hero}</div>
      </div>
      <div className="relative -mt-8 rounded-t-[2rem] bg-background sm:-mt-10">
        {children}
      </div>
    </>
  );
}
