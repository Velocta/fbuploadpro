import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { DesktopTitleBar } from '@/components/desktop';

export const metadata: Metadata = {
  title: 'FBUploadPro',
  description: 'Enterprise multi-tenant Facebook publishing automation platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <DesktopTitleBar />
        <main>{children}</main>
      </body>
    </html>
  );
}
