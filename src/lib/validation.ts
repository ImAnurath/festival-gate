import { z } from "zod";
import { normalizeTrPhone } from "./phone";

export function buildApplicationSchema(maxTickets: number) {
  return z
    .object({
      name: z.string().trim().min(1, "Ad soyad gerekli").max(120, "Ad soyad çok uzun"),
      email: z.email("Geçerli bir e-posta adresi girin"),
      phone: z
        .string()
        .trim()
        .optional()
        .default("")
        .transform((v, ctx) => {
          if (v === "") return null;
          const e164 = normalizeTrPhone(v);
          if (!e164) {
            ctx.addIssue({ code: "custom", message: "Geçerli bir telefon numarası girin" });
            return z.NEVER;
          }
          return e164;
        }),
      socialTags: z
        .string()
        .trim()
        .min(1, "Sosyal medya hesabı gerekli")
        .max(500, "Çok uzun"),
      ticketQuantity: z.coerce
        .number()
        .int("Bilet sayısı bir tam sayı olmalı")
        .min(1, "En az 1 bilet seçin")
        .max(maxTickets, `En fazla ${maxTickets} bilet alabilirsiniz`),
      guestNames: z
        .array(z.string().trim().min(1, "Misafir adı boş olamaz").max(80, "Misafir adı çok uzun"))
        .max(maxTickets - 1),
      guestSocials: z
        .array(
          z
            .string()
            .trim()
            .min(1, "Misafir Instagram hesabı gerekli")
            .max(500, "Misafir Instagram hesabı çok uzun")
        )
        .max(maxTickets - 1)
        .default([]),
      childCount: z.coerce
        .number()
        .int("Çocuk sayısı bir tam sayı olmalı")
        .min(0, "Çocuk sayısı negatif olamaz")
        .max(10, "En fazla 10 çocuk ekleyebilirsiniz")
        .default(0),
      website: z.string().max(0, "Bu alan boş olmalı").optional().default(""),
    })
    .refine((d) => d.guestNames.length === d.ticketQuantity - 1, {
      message: "Misafir adı sayısı, bilet sayısından bir eksik olmalıdır",
      path: ["guestNames"],
    })
    .refine((d) => d.guestSocials.length === d.ticketQuantity - 1, {
      message: "Her misafir için bir Instagram hesabı girin",
      path: ["guestSocials"],
    });
}

export type ApplicationInput = z.infer<ReturnType<typeof buildApplicationSchema>>;
