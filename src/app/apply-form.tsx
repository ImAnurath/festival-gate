"use client";

import { useActionState, useState } from "react";
import { submitApplication, type SubmitState } from "./apply/actions";

export default function ApplyForm({ maxTickets }: { maxTickets: number }) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(
    submitApplication,
    {}
  );
  const [quantity, setQuantity] = useState(1);
  const guestCount = Math.max(0, quantity - 1);

  return (
    <form action={action} className="space-y-4">
      <input name="name" placeholder="Full name" required className="w-full border p-2" />
      <input name="email" type="email" placeholder="Email" required className="w-full border p-2" />
      <input
        name="socialTags"
        placeholder="Your public social handles (e.g. @you on Instagram)"
        required
        className="w-full border p-2"
      />
      <label className="block">
        Tickets
        <select
          name="ticketQuantity"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="ml-2 border p-2"
        >
          {Array.from({ length: maxTickets }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      {Array.from({ length: guestCount }, (_, i) => (
        <input
          key={i}
          name="guestNames"
          placeholder={`Guest ${i + 1} first name`}
          required
          className="w-full border p-2"
        />
      ))}
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />
      <label className="block text-sm text-gray-600">
        <input type="checkbox" required className="mr-2" />
        I consent to my data (and my guests&apos; first names, with their permission)
        being stored for event entry, and deleted after the event.
      </label>
      {state.error && <p className="text-red-600">{state.error}</p>}
      <button disabled={pending} className="bg-black px-4 py-2 text-white">
        {pending ? "Submitting..." : "Apply"}
      </button>
    </form>
  );
}
