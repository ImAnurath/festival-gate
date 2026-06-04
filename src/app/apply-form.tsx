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
      <input name="name" placeholder="Ad Soyad" required className="w-full border p-2" />
      <input name="email" type="email" placeholder="E-posta" required className="w-full border p-2" />
      <input
        name="socialTags"
        placeholder="Herkese açık sosyal medya hesaplarınız (örn. Instagram'da @siz)"
        required
        className="w-full border p-2"
      />
      <label className="block">
        Bilet sayısı
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
          placeholder={`${i + 1}. misafirin adı`}
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
        Verilerimin (ve izinleriyle birlikte misafirlerimin adlarının)
        etkinlik girişi için saklanmasını ve etkinlik sonrasında silinmesini
        kabul ediyorum.
      </label>
      {state.error && <p className="text-red-600">{state.error}</p>}
      <button disabled={pending} className="bg-black px-4 py-2 text-white">
        {pending ? "Gönderiliyor..." : "Başvur"}
      </button>
    </form>
  );
}
