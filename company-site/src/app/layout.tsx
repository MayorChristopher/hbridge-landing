import type { Metadata } from "next";
import { Montserrat, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingActions } from "@/components/floating-actions";
import { MotionProviders } from "@/components/motion/providers";
import { SITE_URL, SITE_NAME } from "@/lib/site";

// Same pairing as the Hbridge app (Montserrat headings, Space Grotesk body)
// so the company site reads as the same brand, not a separate identity.
const montserrat = Montserrat({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const description =
  "Hbridge connects patients, doctors, and hospitals across Nigeria for fast, trusted care — book consultations, message practitioners, and manage medical records in one place.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Hbridge — Healthcare for All",
  description,
  keywords: [
    "Hbridge",
    "healthcare Nigeria",
    "telemedicine Nigeria",
    "book a doctor Nigeria",
    "online consultation Nigeria",
    "medical records app",
    "find a doctor Nigeria",
    "hospital app Nigeria",
  ],
  authors: [{ name: SITE_NAME }],
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Hbridge — Healthcare for All",
    description,
    locale: "en_NG",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Hbridge — Healthcare for All" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hbridge — Healthcare for All",
    description,
    images: ["/og-image.png"],
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/hbridge-logo-full.png`,
  description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <MotionProviders>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <FloatingActions />
        </MotionProviders>
      </body>
    </html>
  );
}
