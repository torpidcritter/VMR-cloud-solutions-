/**
 * Rule-based matching between a job opening and a candidate. Every point of
 * the score comes from a rule a recruiter can read, and each match lists its
 * reasons and its gaps. Nothing is guessed by a model.
 *
 *   Skills        50  each skill on the profile counts fully; found only in a resume counts 60%
 *   SAP module    15  on the profile (specialisation, skills, title), or 10 if only in a resume
 *   Experience    20  at or above the opening's minimum; 10 if within a year of it
 *   Location      10  same city (current or preferred), or a remote role
 *   Availability   5  can join within 30 days
 *
 * Rules with nothing to compare (an opening without a minimum, say) are left
 * out and the score is scaled to the rules that apply.
 */

export type MatchOpening = {
  title: string;
  sap_module: string;
  skills: string[];
  location: string;
  work_mode: string;
  experience: string;
  min_experience_years: number | null;
};

export type MatchCandidate = {
  skills: string[];
  specialisation: string;
  current_title: string;
  experience: string;
  experience_years: number | null;
  location: string;
  preferred_location: string;
  availability: string;
  notice_period: string;
};

export type Reason = { ok: boolean; text: string };
export type Match = { score: number; reasons: Reason[]; parts: { rule: string; got: number; of: number }[] };

/** "S/4HANA" and "S/4 HANA" and "s4hana" compare equal. */
export const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The core of a search pattern for a term, shared by the database (Postgres
 * regex) and the app (JavaScript regex): letters and digits must match, and
 * any punctuation or spacing between them may differ a little.
 */
export function termPattern(term: string) {
  // Letters and digits split too, so "S/4HANA" also finds "S/4 HANA" and "S4HANA".
  const chunks = term.toLowerCase().match(/[a-z]+|[0-9]+/g) ?? [];
  return chunks.map(escape).join("[^a-z0-9]{0,3}");
}

/** Postgres: whole-word, case-insensitive (use with ~*). */
export const pgTermRegex = (term: string) => `(^|[^a-z0-9])${termPattern(term)}([^a-z0-9]|$)`;

/** Terms found in a piece of text, as whole words. */
export function termsIn(text: string, terms: string[]) {
  const t = text.toLowerCase();
  return terms.filter((term) => {
    const p = termPattern(term);
    return p && new RegExp(`(^|[^a-z0-9])${p}([^a-z0-9]|$)`, "i").test(t);
  });
}

/** Skills an opening asks for, without duplicates, at most 15. */
export function openingTerms(o: Pick<MatchOpening, "skills" | "sap_module">) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of o.skills) {
    const k = compact(s);
    if (k.length < 2 || seen.has(k)) continue;
    seen.add(k);
    out.push(s.trim());
  }
  const mod = o.sap_module.trim();
  if (mod && !seen.has(compact(mod))) out.push(mod);
  return out.slice(0, 15);
}

/** The lower end of a range such as "3–5 years" or "15+ years"; "Less than 2 years" is 0. */
export function yearsFrom(text: string): number | null {
  if (!text) return null;
  if (/less than|fresher|^0/i.test(text)) return 0;
  const m = /(\d+(?:\.\d+)?)/.exec(text);
  return m ? Number(m[1]) : null;
}

/** "SAP FICO" on a profile also counts as "SAP FI" and "SAP CO". */
const expand = (profile: string[]) => profile.flatMap((p) => (/fico/i.test(p) ? [p, p.replace(/fico/i, "FI"), p.replace(/fico/i, "CO")] : [p]));

/** Same skill, or the profile entry contains it as whole words ("SAP FI, S/4HANA" contains "S/4HANA"). */
const skillOnProfile = (skill: string, profile: string[]) => {
  const k = compact(skill);
  return expand(profile).some((p) => compact(p) === k || (k.length >= 2 && termsIn(p, [skill]).length > 0));
};

const city = (s: string) =>
  s
    .toLowerCase()
    .split(/[,/;()|-]+|\bor\b|\band\b/)
    .map((x) => x.trim())
    .filter((x) => x.length > 1 && !/^(india|remote|hybrid|onsite|on-site|anywhere)$/.test(x));

export function scoreMatch(o: MatchOpening, c: MatchCandidate, resumeTerms: string[] = []): Match {
  const reasons: Reason[] = [];
  const parts: Match["parts"] = [];
  const inResume = new Set(resumeTerms.map(compact));
  const profile = [...c.skills, c.specialisation, c.current_title].filter(Boolean);

  // Skills
  const wanted = o.skills.map((s) => s.trim()).filter(Boolean);
  if (wanted.length) {
    const onProfile = wanted.filter((s) => skillOnProfile(s, profile));
    const resumeOnly = wanted.filter((s) => !onProfile.includes(s) && inResume.has(compact(s)));
    const missing = wanted.filter((s) => !onProfile.includes(s) && !resumeOnly.includes(s));
    const got = (50 * (onProfile.length + 0.6 * resumeOnly.length)) / wanted.length;
    parts.push({ rule: "Skills", got, of: 50 });
    if (onProfile.length) reasons.push({ ok: true, text: `Has ${onProfile.join(", ")} (${onProfile.length} of ${wanted.length} skills)` });
    if (resumeOnly.length) reasons.push({ ok: true, text: `Resume mentions ${resumeOnly.join(", ")}` });
    if (missing.length) reasons.push({ ok: false, text: `No sign of ${missing.join(", ")}` });
  }

  // SAP module
  const mod = o.sap_module.trim();
  if (mod) {
    const has = skillOnProfile(mod, profile);
    const resume = !has && inResume.has(compact(mod));
    parts.push({ rule: "SAP module", got: has ? 15 : resume ? 10 : 0, of: 15 });
    reasons.push(has ? { ok: true, text: `Works in SAP ${mod.replace(/^sap\s+/i, "")}` } : resume ? { ok: true, text: `Resume mentions ${mod}` } : { ok: false, text: `${mod} not on the profile` });
  }

  // Experience
  const need = o.min_experience_years ?? yearsFrom(o.experience);
  if (need !== null && need > 0) {
    const years = c.experience_years ?? yearsFrom(c.experience);
    if (years === null) {
      parts.push({ rule: "Experience", got: 0, of: 20 });
      reasons.push({ ok: false, text: "Experience not recorded" });
    } else {
      const got = years >= need ? 20 : years >= need - 1 ? 10 : 0;
      parts.push({ rule: "Experience", got, of: 20 });
      reasons.push(years >= need ? { ok: true, text: `${fmtYears(years)} experience (needs ${need}+)` } : { ok: false, text: `${fmtYears(years)} experience, below the ${need}+ asked` });
    }
  }

  // Location
  const remote = /remote/i.test(o.work_mode) || /remote/i.test(o.location);
  const jobCities = city(o.location);
  if (remote) {
    parts.push({ rule: "Location", got: 10, of: 10 });
    reasons.push({ ok: true, text: "Remote role" });
  } else if (jobCities.length) {
    const theirs = [...city(c.location), ...city(c.preferred_location)];
    const hit = jobCities.find((j) => theirs.some((t) => t.includes(j) || j.includes(t)));
    parts.push({ rule: "Location", got: hit ? 10 : 0, of: 10 });
    if (hit) reasons.push({ ok: true, text: `${cap(hit)} works for them` });
    else reasons.push({ ok: false, text: theirs.length ? `Based in ${c.location || c.preferred_location}, role is in ${o.location}` : "Location not recorded" });
  }

  // Availability
  const avail = c.availability || c.notice_period;
  if (avail) {
    const days = /immediate/i.test(avail) ? 0 : Number(/(\d+)\s*(day|d\b)/i.exec(avail)?.[1] ?? (/(\d+)\s*month/i.exec(avail) ? Number(/(\d+)\s*month/i.exec(avail)![1]) * 30 : NaN));
    const notLooking = /not looking/i.test(avail);
    const soon = !notLooking && Number.isFinite(days) && days <= 30;
    parts.push({ rule: "Availability", got: soon ? 5 : 0, of: 5 });
    if (notLooking) reasons.push({ ok: false, text: "Marked as not looking" });
    else if (soon) reasons.push({ ok: true, text: days === 0 ? "Can join immediately" : `Can join ${avail.toLowerCase()}` });
  }

  const of = parts.reduce((n, p) => n + p.of, 0);
  const got = parts.reduce((n, p) => n + p.got, 0);
  return { score: of ? Math.round((got / of) * 100) : 0, reasons, parts };
}

const fmtYears = (y: number) => `${Number.isInteger(y) ? y : y.toFixed(1)} yr${y === 1 ? "" : "s"}`;
const cap = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase());
