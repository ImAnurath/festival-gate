// The reviewer's public demo pay page is backed by a single seeded Application
// with this fixed token. It is non-consumable: the payment callback never marks
// it PAID, so every reviewer (and re-review) sees a working payment step.
export const SHOWCASE_PAY_TOKEN = "showcase-kindzi-demo";

export function isShowcaseToken(token: string | null | undefined): boolean {
  return token === SHOWCASE_PAY_TOKEN;
}
