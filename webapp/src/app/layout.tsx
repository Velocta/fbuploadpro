import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { validateRuntimeEnv } from '@/lib/config/env'

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

import { headers } from "next/headers";
import { getBrandConfig } from "@/lib/config/brand";
import { BrandProvider } from "@/components/brand-provider";

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const host = headersList.get("host") || "fbuploadpro.com";
  const brand = getBrandConfig(host);

  return {
    title: `${brand.name} | Facebook Distribution Platform`,
    description: `Automate trusted content distribution to Facebook pages with clear controls and agency-ready workflows.`,
    icons: {
      icon: brand.logoUrl,
      shortcut: brand.logoUrl,
      apple: brand.logoUrl,
    }
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (process.env.NODE_ENV === 'production') {
    validateRuntimeEnv()
  }

  const headersList = await headers();
  const host = headersList.get("host") || "fbuploadpro.com";
  const brandConfig = getBrandConfig(host);

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${inter.variable} ${plusJakartaSans.variable} ${jetBrainsMono.variable} antialiased font-sans bg-background text-foreground`}
      >
        <BrandProvider brand={brandConfig}>
          {children}
        </BrandProvider>
        <Toaster position="top-right" richColors />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}

