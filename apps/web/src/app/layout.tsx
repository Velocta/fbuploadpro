import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { DesktopTitleBar } from '@/components/desktop';
import { WhatsAppSupportButton } from '@/components/support';

export const metadata: Metadata = {
  title: 'FBUploadPro',
  description: 'publishing automation platform',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/favicon.ico',
    apple: '/icon.svg',
  },
};

const themeInitScript = `
  (function() {
    try {
      var theme = localStorage.getItem('theme');
      if (!theme) {
        var match = document.cookie.match(/(?:^|;\\s*)fbup_theme=([^;]+)/);
        if (match) theme = match[1];
      }
      var resolved = theme === 'light' ? 'light' : 'dark';
      document.documentElement.dataset.theme = resolved;
      document.documentElement.classList.remove('dark', 'light');
      document.documentElement.classList.add(resolved);
    } catch (e) {
      document.documentElement.dataset.theme = 'dark';
      document.documentElement.classList.add('dark');
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <DesktopTitleBar />
        <main>{children}</main>
        <WhatsAppSupportButton />
      </body>
    </html>
  );
}
