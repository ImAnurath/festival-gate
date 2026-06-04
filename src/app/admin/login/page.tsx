"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, { error: "" });
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-xl font-bold">Admin login</h1>
      <form action={action} className="mt-6 space-y-4">
        <input name="email" type="email" placeholder="Email" required className="w-full border p-2" />
        <input name="password" type="password" placeholder="Password" required className="w-full border p-2" />
        {state.error && <p className="text-red-600">{state.error}</p>}
        <button disabled={pending} className="bg-black px-4 py-2 text-white">Log in</button>
      </form>
    </main>
  );
}
