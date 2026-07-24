import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Admin sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">Use the Supabase admin account assigned in profiles.</p>
        <LoginForm />
      </section>
    </main>
  );
}
