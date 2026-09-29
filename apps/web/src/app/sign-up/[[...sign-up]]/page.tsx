import { SignUp } from '@clerk/nextjs';

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
        <SignUp
          appearance={{
            elements: {
              card: 'bg-zinc-900 border border-zinc-800 shadow-2xl text-zinc-100',
              headerTitle: 'text-zinc-100 font-bold',
              headerSubtitle: 'text-zinc-400',
              formButtonPrimary: 'bg-indigo-600 hover:bg-indigo-500 text-white font-medium',
              footerActionLink: 'text-indigo-400 hover:text-indigo-300',
            },
          }}
        />
      </div>
    </main>
  );
}
