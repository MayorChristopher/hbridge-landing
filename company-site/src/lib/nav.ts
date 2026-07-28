import { CalendarClock, Zap, MessageSquare, FileText } from "lucide-react";

export const NAV_LINKS = [
  {
    label: "Product",
    href: "/product",
    preview: [
      {
        icon: CalendarClock,
        title: "Booking",
        description: "Book a consultation with a verified practitioner in a few taps.",
        href: "/product#booking",
      },
      {
        icon: Zap,
        title: "Quick Consultation",
        description: "Skip scheduling — get matched to the next available doctor now.",
        href: "/product#quick-consultation",
      },
      {
        icon: MessageSquare,
        title: "Messaging & calling",
        description: "Secure in-app chat and calls, tied to your care history.",
        href: "/product#messaging",
      },
      {
        icon: FileText,
        title: "Medical records",
        description: "Your records, encrypted, with access you control.",
        href: "/product#records",
      },
    ],
  },
  { label: "For Practitioners", href: "/practitioners" },
  { label: "For Hospitals", href: "/hospitals" },
  { label: "Community", href: "/community" },
  { label: "About", href: "/about" },
] as const;

export const FOOTER_LINKS = {
  Product: [
    { label: "Overview", href: "/product" },
    { label: "For Practitioners", href: "/practitioners" },
    { label: "For Hospitals", href: "/hospitals" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Community", href: "/community" },
    { label: "Careers", href: "/careers" },
    { label: "Contact", href: "/contact" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
  ],
} as const;
