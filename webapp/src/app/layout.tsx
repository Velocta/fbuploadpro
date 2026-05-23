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

export const metadata: Metadata = {
  title: "FBupload Pro | Facebook Distribution Platform",
  description: "Automate trusted content distribution to Facebook pages with clear controls and agency-ready workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (process.env.NODE_ENV === 'production') {
    validateRuntimeEnv()
  }

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${inter.variable} ${plusJakartaSans.variable} ${jetBrainsMono.variable} antialiased font-sans bg-background text-foreground`}
      >
        {children}
        <Toaster position="top-right" richColors />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
