import Image from "next/image";
import type { ReactNode } from "react";

import { Reveal } from "@/components/motion/reveal";

export function FeatureRow({
  id,
  eyebrow,
  title,
  children,
  image,
  imageAlt,
  reverse = false,
  tint = false,
  variant = "mockup",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  children: ReactNode;
  image: string;
  imageAlt: string;
  reverse?: boolean;
  tint?: boolean;
  /** "mockup" = portrait phone screenshot (default). "photo" = landscape photograph. */
  variant?: "mockup" | "photo";
}) {
  return (
    <section id={id} className={`scroll-mt-28 ${tint ? "border-y border-border bg-muted/40" : ""}`}>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal className={reverse ? "lg:order-2" : ""}>
            {eyebrow && (
              <p className="text-sm font-semibold tracking-wide text-primary uppercase">
                {eyebrow}
              </p>
            )}
            <h2 className="font-heading mt-2 text-3xl font-bold text-foreground sm:text-4xl">
              {title}
            </h2>
            <div className="mt-4 text-muted-foreground leading-relaxed">{children}</div>
          </Reveal>

          <Reveal delay={0.1} className={reverse ? "lg:order-1" : ""}>
            {variant === "photo" ? (
              <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl">
                <Image
                  src={image}
                  alt={imageAlt}
                  width={1200}
                  height={900}
                  className="aspect-4/3 w-full object-cover"
                />
              </div>
            ) : (
              <div className="mx-auto w-full max-w-xs overflow-hidden rounded-[2rem]">
                <Image
                  src={image}
                  alt={imageAlt}
                  width={420}
                  height={860}
                  className="w-full"
                />
              </div>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
