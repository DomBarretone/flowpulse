import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
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
      appearance={{
        variables: {
          colorBackground: '#0b0f17',
          colorNeutral: '#f3f4f6',
          colorPrimary: '#7c6cf2',
        },
        elements: {
          card: 'bg-zinc-900 border border-zinc-800 shadow-xl',
          navbar: 'bg-zinc-900 border-zinc-800',
          headerTitle: 'text-zinc-100',
          headerSubtitle: 'text-zinc-400',
          formButtonPrimary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
          footerActionLink: 'text-indigo-400 hover:text-indigo-300',
        },
      }}
    >
      <html lang="pt-BR">
        <body className="antialiased min-h-screen bg-background text-text">{children}</body>
      </html>
    </ClerkProvider>
  );
}
