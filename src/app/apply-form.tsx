"use client";

import { useActionState, useState } from "react";
import { submitApplication, type SubmitState } from "./apply/actions";

const labelClass = "mb-1.5 block text-xs uppercase tracking-[0.18em] text-moss";

export default function ApplyForm({ maxTickets }: { maxTickets: number }) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(
    submitApplication,
    {}
  );
  const [quantity, setQuantity] = useState(1);
  const guestCount = Math.max(0, quantity - 1);

  return (
    <form action={action} className="space-y-6">
      <div>
        <label className={labelClass} htmlFor="name">
          Ad Soyad
        </label>
        <input id="name" name="name" placeholder="Adınız ve soyadınız" required className="field" />
      </div>

      <div>
        <label className={labelClass} htmlFor="email">
          E-posta
        </label>
        <input id="email" name="email" type="email" placeholder="ornek@eposta.com" required className="field" />
      </div>

      <div>
        <label className={labelClass} htmlFor="socialTags">
          Sosyal medya
        </label>
        <input
          id="socialTags"
          name="socialTags"
          placeholder="Instagram'da @kullaniciadi"
          required
          className="field"
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="ticketQuantity">
          Bilet sayısı
        </label>
        <select
          id="ticketQuantity"
          name="ticketQuantity"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="field"
        >
          {Array.from({ length: maxTickets }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} bilet
            </option>
          ))}
        </select>
      </div>

      {guestCount > 0 && (
        <div className="space-y-3">
          <p className={labelClass}>Misafirler</p>
          {Array.from({ length: guestCount }, (_, i) => (
            <input
              key={i}
              name="guestNames"
              placeholder={`${i + 1}. misafirin adı`}
              required
              className="field"
            />
          ))}
        </div>
      )}

      {/* bal tuzağı: insanlardan gizli, botlar doldurur */}
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <label className="flex items-start gap-3 text-sm leading-relaxed text-moss">
        <input type="checkbox" required className="mt-1 accent-hazel" />
        <span>
          Verilerimin (ve izinleriyle birlikte misafirlerimin adlarının)
          etkinlik girişi için saklanmasını ve etkinlik sonrasında silinmesini
          kabul ediyorum.
        </span>
      </label>

      {state.error && (
        <p className="rounded-sm border border-hazel/40 bg-hazel/10 px-3 py-2 text-sm text-hazel">
          {state.error}
        </p>
      )}

      <button
        disabled={pending}
        className="w-full rounded-sm bg-ink px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-cream transition-all duration-300 hover:-translate-y-0.5 hover:bg-sea disabled:translate-y-0 disabled:opacity-60"
      >
        {pending ? "Gönderiliyor..." : "Başvuruyu gönder"}
      </button>
    </form>
  );
}
