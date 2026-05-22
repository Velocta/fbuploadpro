"use client";

import { Geist, Geist_Mono } from "next/font/google";
import { Button } from "@/components/ui/button";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-foreground">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Something went wrong!
            </h2>
            <p className="text-muted-foreground">
              A critical error occurred. Please try again later.
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded-sm mt-2">
                Error Digest: {error.digest}
              </p>
            )}
          </div>
          <Button onClick={() => reset()} variant="default" size="lg">
            Try again
          </Button>
        </div>
      </body>
    </html>
  );
}