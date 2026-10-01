import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerk-appearance';
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
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/sign-in'}
      signUpUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || '/sign-up'}
      signInFallbackRedirectUrl={
        process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL || '/dashboard'
      }
      signUpFallbackRedirectUrl={
        process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL || '/dashboard'
      }
      appearance={clerkAppearance}
    >
      <html lang="pt-BR">
        <body className="antialiased min-h-screen bg-background text-text">{children}</body>
      </html>
    </ClerkProvider>
  );
}
