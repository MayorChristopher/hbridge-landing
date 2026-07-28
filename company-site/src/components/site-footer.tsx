import Image from "next/image";
import Link from "next/link";

import { FOOTER_LINKS } from "@/lib/nav";

export function SiteFooter() {
  return (
    <footer className="bg-brand-ink">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-full bg-white">
                <Image src="/hbridge-logo-full.png" alt="" width={43} height={52} className="h-7 w-auto" />
              </div>
              <span className="font-heading text-xl font-bold text-white">Hbridge</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">
              Healthcare for All. Connecting patients, practitioners, and hospitals across Nigeria.
            </p>
            <p className="mt-3 text-xs text-white/40">Built in Nigeria, for Nigerians.</p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([section, links]) => (
            <div key={section}>
              <h3 className="font-heading text-sm font-semibold text-white">{section}</h3>
              <ul className="mt-3 flex flex-col gap-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/60 transition-colors hover:text-brand-gold"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} Hbridge. All rights reserved.
          </p>
          <p className="text-xs text-white/50">Made for Nigeria</p>
        </div>
      </div>
    </footer>
  );
}
