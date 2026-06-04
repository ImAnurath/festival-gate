import { describe, it, expect } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("quotes a plain value", () => {
    expect(csvCell("Ali")).toBe('"Ali"');
  });
  it("escapes embedded quotes", () => {
    expect(csvCell('a"b')).toBe('"a""b"');
  });
  it("neutralizes a leading = formula", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
  });
  it("neutralizes leading + - @", () => {
    expect(csvCell("+1")).toBe(`"'+1"`);
    expect(csvCell("-1")).toBe(`"'-1"`);
    expect(csvCell("@x")).toBe(`"'@x"`);
  });
});

describe("toCsv", () => {
  it("builds header + rows with CRLF", () => {
    expect(toCsv(["A", "B"], [["1", "2"]])).toBe('"A","B"\r\n"1","2"');
  });
});
