import { ShieldOff } from "lucide-react";

export default function AccountSuspendedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e7d5bd] px-4 py-8 text-[#2f241d]">
      <section className="w-full max-w-xl rounded-[24px] border border-white/70 bg-[#fffaf3]/95 p-8 text-center shadow-2xl shadow-[#7f5a2d]/15 backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#d8b98e] bg-white/70 text-[#b98537]">
          <ShieldOff className="h-8 w-8" />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.22em] text-[#b17d33]">
          Account suspended
        </p>
        <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight text-[#2d211a]">
          Uploads are paused
        </h1>
        <div className="mx-auto mt-5 h-px w-32 bg-gradient-to-r from-transparent via-[#c18a3b] to-transparent" />
        <p className="mx-auto mt-6 max-w-md text-lg leading-8 text-[#4a3b32]">
          This reseller account is suspended. Please contact your service provider.
        </p>
      </section>
    </main>
  );
}
