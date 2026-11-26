/**
 * Contact details shown to roles that don't contact candidates (Viewer,
 * Sales). Enough is kept to tell two records apart, not to reach the person.
 */
export function maskEmail(email: string | null | undefined) {
  const e = (email ?? "").trim();
  const at = e.lastIndexOf("@");
  if (at < 1) return e ? "•••" : "";
  return `${e.slice(0, Math.min(2, at))}•••@${e.slice(at + 1)}`;
}

export function maskPhone(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return `•••• ${digits.slice(-2)}`;
}
