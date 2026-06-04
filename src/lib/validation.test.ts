import { describe, it, expect } from "vitest";
import { buildApplicationSchema } from "./validation";

const schema = buildApplicationSchema(6);
const valid = {
  name: "Ali Veli",
  email: "ali@example.com",
  socialTags: "@ali_insta",
  ticketQuantity: 3,
  guestNames: ["Ayse", "Mehmet"],
  website: "",
};

describe("application schema", () => {
  it("accepts a valid party of 3 with 2 guests", () => {
    expect(schema.parse(valid)).toMatchObject({ ticketQuantity: 3 });
  });
  it("rejects when guest count does not equal quantity - 1", () => {
    expect(() => schema.parse({ ...valid, guestNames: ["Ayse"] })).toThrow();
  });
  it("rejects quantity above the max", () => {
    expect(() =>
      schema.parse({ ...valid, ticketQuantity: 7, guestNames: ["a", "b", "c", "d", "e", "f"] })
    ).toThrow();
  });
  it("rejects a quantity below 1", () => {
    expect(() => schema.parse({ ...valid, ticketQuantity: 0, guestNames: [] })).toThrow();
  });
  it("accepts a solo buyer with no guests", () => {
    expect(() =>
      schema.parse({ ...valid, ticketQuantity: 1, guestNames: [] })
    ).not.toThrow();
  });
  it("rejects a bad email", () => {
    expect(() => schema.parse({ ...valid, email: "nope" })).toThrow();
  });
  it("rejects when the honeypot is filled", () => {
    expect(() => schema.parse({ ...valid, website: "spam" })).toThrow();
  });
});
