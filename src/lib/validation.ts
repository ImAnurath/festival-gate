import { z } from "zod";

export function buildApplicationSchema(maxTickets: number) {
  return z
    .object({
      name: z.string().trim().min(1).max(120),
      email: z.email(),
      socialTags: z.string().trim().min(1).max(500),
      ticketQuantity: z.coerce.number().int().min(1).max(maxTickets),
      guestNames: z.array(z.string().trim().min(1).max(80)).max(maxTickets - 1),
      website: z.string().max(0, "honeypot must be empty").optional().default(""),
    })
    .refine((d) => d.guestNames.length === d.ticketQuantity - 1, {
      message: "Number of guest names must equal ticket quantity minus one",
      path: ["guestNames"],
    });
}

export type ApplicationInput = z.infer<ReturnType<typeof buildApplicationSchema>>;
