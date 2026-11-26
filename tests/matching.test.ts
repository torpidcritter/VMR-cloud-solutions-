import { describe, expect, it } from "vitest";
import { openingTerms, scoreMatch, termsIn, yearsFrom, type MatchCandidate, type MatchOpening } from "@/lib/matching";

const opening: MatchOpening = {
  title: "SAP S/4HANA FICO Consultant",
  sap_module: "FICO",
  skills: ["SAP FI", "SAP CO", "S/4HANA", "Asset Accounting"],
  location: "Bengaluru",
  work_mode: "Hybrid",
  experience: "3–5 years",
  min_experience_years: 4,
};
const blank: MatchCandidate = { skills: [], specialisation: "", current_title: "", experience: "", experience_years: null, location: "", preferred_location: "", availability: "", notice_period: "" };

describe("matching rules", () => {
  it("finds whole terms, ignoring case and punctuation differences", () => {
    expect(termsIn("Led an S/4 HANA migration; strong in sap fi.", ["S/4HANA", "SAP FI", "SAP CO"])).toEqual(["S/4HANA", "SAP FI"]);
    // "SAP CO" is not "SAP Consultant", and "FI" is not inside "finance".
    expect(termsIn("SAP Consultant in finance", ["SAP CO", "FI"])).toEqual([]);
    expect(openingTerms({ skills: ["SAP FI", "sap fi", " "], sap_module: "FICO" })).toEqual(["SAP FI", "FICO"]);
  });

  it("reads the lower end of experience ranges", () => {
    expect(yearsFrom("3–5 years")).toBe(3);
    expect(yearsFrom("15+ years")).toBe(15);
    expect(yearsFrom("Less than 2 years")).toBe(0);
    expect(yearsFrom("")).toBeNull();
  });

  it("scores a strong profile highly and explains why", () => {
    const m = scoreMatch(opening, { ...blank, skills: ["SAP FICO", "S/4HANA"], specialisation: "SAP FICO", experience_years: 6, location: "Bengaluru, Karnataka", availability: "Within 15 days" }, ["Asset Accounting"]);
    // FI and CO come from "SAP FICO"; Asset Accounting only from the resume (60%).
    expect(m.parts).toEqual([
      { rule: "Skills", got: 50 * (3 + 0.6) / 4, of: 50 },
      { rule: "SAP module", got: 15, of: 15 },
      { rule: "Experience", got: 20, of: 20 },
      { rule: "Location", got: 10, of: 10 },
      { rule: "Availability", got: 5, of: 5 },
    ]);
    expect(m.score).toBe(95);
    expect(m.reasons.filter((r) => r.ok).map((r) => r.text)).toEqual([
      "Has SAP FI, SAP CO, S/4HANA (3 of 4 skills)",
      "Resume mentions Asset Accounting",
      "Works in SAP FICO",
      "6 yrs experience (needs 4+)",
      "Bengaluru works for them",
      "Can join within 15 days",
    ]);
  });

  it("lists the gaps and leaves out rules with nothing to compare", () => {
    const m = scoreMatch({ ...opening, min_experience_years: null, experience: "" }, { ...blank, skills: ["SAP CO"], location: "Pune", availability: "Not looking" });
    expect(m.parts.map((p) => p.rule)).toEqual(["Skills", "SAP module", "Location", "Availability"]);
    expect(m.reasons.filter((r) => !r.ok).map((r) => r.text)).toEqual(["No sign of SAP FI, S/4HANA, Asset Accounting", "FICO not on the profile", "Based in Pune, role is in Bengaluru", "Marked as not looking"]);
    expect(m.score).toBe(Math.round((12.5 / 80) * 100));
  });

  it("treats remote roles as a location match and a near miss on experience as half", () => {
    const m = scoreMatch({ ...opening, work_mode: "Remote" }, { ...blank, experience: "3–5 years" });
    expect(m.parts.find((p) => p.rule === "Location")?.got).toBe(10);
    expect(m.parts.find((p) => p.rule === "Experience")?.got).toBe(10);
    expect(m.reasons.some((r) => r.text === "3 yrs experience, below the 4+ asked")).toBe(true);
  });
});
