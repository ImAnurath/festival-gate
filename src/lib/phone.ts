// Normalize a Turkish mobile number to E.164 (+90XXXXXXXXXX), or null if it is
// not a valid Turkish mobile. Accepts common user formats: leading 0, +90, 90,
// or a bare 10-digit number, with spaces, dashes, or parentheses.
export function normalizeTrPhone(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, "");

  let national: string;
  if (digits.startsWith("+90")) national = digits.slice(3);
  else if (digits.startsWith("90")) national = digits.slice(2);
  else if (digits.startsWith("0")) national = digits.slice(1);
  else national = digits;

  // A Turkish mobile is 10 digits and starts with 5 (e.g. 5XX XXX XX XX).
  if (!/^5\d{9}$/.test(national)) return null;
  return `+90${national}`;
}
