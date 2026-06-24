import { describe, it, expect } from "vitest";
import { buildApplicationSchema } from "./validation";

const schema = buildApplicationSchema(6);
const valid = {
  name: "Ali Veli",
  email: "ali@example.com",
  socialTags: "@ali_insta",
  ticketQuantity: 3,
  guestNames: ["Ayse", "Mehmet"],
  guestSocials: ["@ayse", "@mehmet"],
  childCount: 0,
  website: "",
};

describe("application schema", () => {
  it("accepts a valid party of 3 with 2 guests", () => {
    expect(schema.parse(valid)).toMatchObject({ ticketQuantity: 3 });
  });
  it("rejects when guest count does not equal quantity - 1", () => {
    expect(() =>
      schema.parse({ ...valid, guestNames: ["Ayse"], guestSocials: ["@ayse"] })
    ).toThrow();
  });
  it("rejects quantity above the max", () => {
    expect(() =>
      schema.parse({
        ...valid,
        ticketQuantity: 7,
        guestNames: ["a", "b", "c", "d", "e", "f"],
        guestSocials: ["@a", "@b", "@c", "@d", "@e", "@f"],
      })
    ).toThrow();
  });
  it("rejects a quantity below 1", () => {
    expect(() =>
      schema.parse({ ...valid, ticketQuantity: 0, guestNames: [], guestSocials: [] })
    ).toThrow();
  });
  it("accepts a solo buyer with no guests", () => {
    expect(() =>
      schema.parse({ ...valid, ticketQuantity: 1, guestNames: [], guestSocials: [] })
    ).not.toThrow();
  });
  it("rejects a bad email", () => {
    expect(() => schema.parse({ ...valid, email: "nope" })).toThrow();
  });
  it("rejects when the honeypot is filled", () => {
    expect(() => schema.parse({ ...valid, website: "spam" })).toThrow();
  });
  it("rejects when guestSocials count does not equal quantity - 1", () => {
    expect(() =>
      schema.parse({ ...valid, guestSocials: ["@ayse"] })
    ).toThrow();
  });
  it("rejects an empty guest Instagram handle", () => {
    expect(() =>
      schema.parse({ ...valid, guestSocials: ["@ayse", "  "] })
    ).toThrow();
  });
  it("defaults childCount to 0 when omitted", () => {
    const { childCount, ...noChild } = valid;
    const r = schema.safeParse(noChild);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.childCount).toBe(0);
  });
  it("accepts a childCount within range", () => {
    const r = schema.safeParse({ ...valid, childCount: 3 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.childCount).toBe(3);
  });
  it("rejects a childCount above 3", () => {
    expect(() => schema.parse({ ...valid, childCount: 4 })).toThrow();
  });
  it("rejects a negative childCount", () => {
    expect(() => schema.parse({ ...valid, childCount: -1 })).toThrow();
  });
});

const base = {
  name: "Ali Veli",
  email: "ali@example.com",
  socialTags: "@ali",
  ticketQuantity: 1,
  guestNames: [],
  guestSocials: [],
  childCount: 0,
  website: "",
};

describe("application phone field", () => {
  it("normalizes a provided phone to E.164", () => {
    const r = buildApplicationSchema(6).safeParse({ ...base, phone: "0532 123 45 67" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe("+905321234567");
  });

  it("treats an empty phone as null (optional)", () => {
    const r = buildApplicationSchema(6).safeParse({ ...base, phone: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBeNull();
  });

  it("treats a missing phone as null (optional)", () => {
    const r = buildApplicationSchema(6).safeParse({ ...base });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBeNull();
  });

  it("rejects an invalid phone", () => {
    const r = buildApplicationSchema(6).safeParse({ ...base, phone: "12345" });
    expect(r.success).toBe(false);
  });
});
