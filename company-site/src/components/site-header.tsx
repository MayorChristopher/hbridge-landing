"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NAV_LINKS } from "@/lib/nav";

function NavItem({
  link,
  active,
}: {
  link: (typeof NAV_LINKS)[number];
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const preview = "preview" in link ? link.preview : undefined;

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <Link
        href={link.href}
        className={`relative text-sm font-medium transition-colors ${
          active || open ? "text-brand-gold" : "text-white/75 hover:text-brand-gold"
        }`}
      >
        {link.label}
        {(active || open) && (
          <motion.span
            layoutId="nav-active-indicator"
            className="absolute -bottom-2 left-0 h-0.5 w-full bg-brand-gold"
            transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
          />
        )}
      </Link>

      {preview && (
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-full left-1/2 z-50 mt-3 w-80 -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl"
            >
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Explore the app
                </p>
              </div>

              <div className="flex flex-col gap-1 p-2">
                {preview.map((p, i) => (
                  <motion.div
                    key={p.href}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.15 }}
                  >
                    <Link
                      href={p.href}
                      className="group/item flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover/item:bg-brand-gold/15">
                        <p.icon
                          className="size-4 text-primary transition-colors group-hover/item:text-brand-gold"
                          aria-hidden
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-popover-foreground">{p.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {p.description}
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>

              <Link
                href={link.href}
                className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-muted"
              >
                See the full product overview
                <span aria-hidden>→</span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-200 ${
        scrolled
          ? "border-b border-white/10 bg-brand-ink/95 shadow-[0_4px_20px_rgba(0,0,0,0.15)] backdrop-blur-sm"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <div className="flex size-10 items-center justify-center rounded-full bg-white">
            <Image src="/hbridge-logo-full.png" alt="" width={43} height={52} priority className="h-7 w-auto" />
          </div>
          <span className="font-heading text-xl font-bold text-white">Hbridge</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <NavItem key={link.href} link={link} active={pathname === link.href} />
          ))}
        </nav>

        <div className="hidden md:block">
          <motion.div
            animate={{ opacity: scrolled ? 1 : 0, scale: scrolled ? 1 : 0.9 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={scrolled ? "" : "pointer-events-none"}
          >
            <Button asChild className="bg-brand-gold text-brand-gold-foreground hover:bg-brand-gold/90">
              <Link href="/download" tabIndex={scrolled ? 0 : -1}>
                Get Early Access
              </Link>
            </Button>
          </motion.div>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="flex size-10 items-center justify-center rounded-md text-white md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-brand-ink md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-4 sm:px-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-md px-3 py-2.5 text-sm font-medium hover:bg-white/10 hover:text-brand-gold ${
                  pathname === link.href ? "text-brand-gold" : "text-white/75"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Button asChild className="mt-2 bg-brand-gold text-brand-gold-foreground hover:bg-brand-gold/90">
              <Link href="/download" onClick={() => setOpen(false)}>
                Get Early Access
              </Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
