// Neutralizes CSV/formula injection and quotes a cell for CSV output.
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

export function csvCell(value: string): string {
  let v = value;
  if (v.length > 0 && FORMULA_PREFIXES.includes(v[0])) {
    v = "'" + v; // prefix with a single quote so spreadsheets treat it as text
  }
  return `"${v.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: string[][]): string {
  const lines = [header.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  return lines.join("\r\n");
}
