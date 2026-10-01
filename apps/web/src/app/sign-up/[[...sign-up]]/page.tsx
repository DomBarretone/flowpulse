import { SignUp } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerk-appearance';

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-zinc-950 text-zinc-100">
      <div className="w-full max-w-md flex flex-col items-center">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">FlowPulse</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Crie sua conta para acessar o console operacional
          </p>
        </div>
        <SignUp appearance={clerkAppearance} />
      </div>
    </main>
  );
}
