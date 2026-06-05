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
      website: z.string().max(0, "Bu alan boş olmalı").optional().default(""),
    })
    .refine((d) => d.guestNames.length === d.ticketQuantity - 1, {
      message: "Misafir adı sayısı, bilet sayısından bir eksik olmalıdır",
      path: ["guestNames"],
    });
}

export type ApplicationInput = z.infer<ReturnType<typeof buildApplicationSchema>>;
