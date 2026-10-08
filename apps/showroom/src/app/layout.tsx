import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FBUploadPro UI Showroom & Component Sandbox',
  description: 'Isolated component review workbench with zero mock code in production.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', color: '#0f172a' }}>
        {children}
      </body>
    </html>
  );
}
