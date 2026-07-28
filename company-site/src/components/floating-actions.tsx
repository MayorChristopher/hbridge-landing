"use client";

import Link from "next/link";
import { Users } from "lucide-react";

const WHATSAPP_NUMBER = "2349025396320"; // 090 254 96320, international format for wa.me

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.04 2c-5.523 0-10 4.477-10 10 0 1.77.464 3.5 1.345 5.02L2 22l5.13-1.345A9.96 9.96 0 0 0 12.04 22c5.523 0 10-4.477 10-10s-4.477-10-10-10zm0 18.15a8.13 8.13 0 0 1-4.146-1.14l-.297-.176-3.045.8.813-2.968-.193-.305A8.15 8.15 0 1 1 20.19 12a8.16 8.16 0 0 1-8.15 8.15z" />
    </svg>
  );
}

export function FloatingActions() {
  return (
    <div className="fixed right-5 bottom-5 z-40 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      <Link
        href="/community"
        aria-label="Visit the Hbridge community"
        className="group flex items-center gap-0 overflow-hidden rounded-full bg-brand-gold text-brand-gold-foreground shadow-lg transition-[gap,padding] hover:gap-2 hover:pr-4"
      >
        <span className="flex size-13 shrink-0 items-center justify-center">
          <Users className="size-5" aria-hidden />
        </span>
        <span className="max-w-0 overflow-hidden text-sm font-semibold whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-40 group-hover:opacity-100">
          Community
        </span>
      </Link>

      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with Hbridge on WhatsApp"
        className="group flex items-center gap-0 overflow-hidden rounded-full bg-[#25D366] text-white shadow-lg transition-[gap,padding] hover:gap-2 hover:pr-4"
      >
        <span className="flex size-13 shrink-0 items-center justify-center">
          <WhatsAppIcon className="size-6" />
        </span>
        <span className="max-w-0 overflow-hidden text-sm font-semibold whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-40 group-hover:opacity-100">
          WhatsApp us
        </span>
      </a>
    </div>
  );
}
