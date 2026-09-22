import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FlowPulse',
  description: 'Sistema de monitoramento contínuo de automações e pipelines',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased min-h-screen bg-background text-text">{children}</body>
    </html>
  );
}
