import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TicketList from "./ticket-list";

const tickets = [
  { id: "1", holderName: "Ayşe Yılmaz", isBuyer: true, code: "KF-7Q4X2" },
  { id: "2", holderName: "Konstantin Büyükşehiroğlu", isBuyer: false, code: "KF-9MHKQ" },
] as any;

describe("TicketList", () => {
  it("renders a row per attendee with name, code, and role label", () => {
    const html = renderToStaticMarkup(<TicketList tickets={tickets} />);
    expect(html).toContain("Ayşe Yılmaz");
    expect(html).toContain("KF-7Q4X2");
    expect(html).toContain("Sahibi");
    expect(html).toContain("Konstantin Büyükşehiroğlu");
    expect(html).toContain("Misafir");
  });
});
