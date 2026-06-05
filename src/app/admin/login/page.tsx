"use client";

import { useActionState } from "react";
import { login } from "./actions";
import BrandLogo from "@/components/brand-logo";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, { error: "" });
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm">
        <BrandLogo size={96} className="mb-5" />
        <p className="text-xs uppercase tracking-[0.28em] text-moss">
          KİNDZİ FEST
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-ink">
          Yönetici girişi
        </h1>
        <form action={action} className="mt-8 space-y-4">
          <input name="email" type="email" placeholder="E-posta" required className="field" />
          <input name="password" type="password" placeholder="Parola" required className="field" />
          {state.error && (
            <p className="rounded-sm border border-hazel/40 bg-hazel/10 px-3 py-2 text-sm text-hazel">
              {state.error}
            </p>
          )}
          <button
            disabled={pending}
            className="w-full rounded-sm bg-ink px-6 py-3 text-sm font-medium uppercase tracking-[0.18em] text-cream transition-colors hover:bg-sea disabled:opacity-60"
          >
            Giriş yap
          </button>
        </form>
      </div>
    </main>
  );
}
