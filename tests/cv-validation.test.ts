import { describe, expect, it } from "vitest";
import { CV_MAX_BYTES, specialisationOptions, validateCv, validateCvFile } from "@/lib/cv";

const valid = {
  fullName: "Priya Sharma",
  email: "Priya@Example.com",
  phone: "+44 20 7946 0958",
  location: "London, UK",
  specialisation: "SAP FI/CO",
  experience: "8–12 years",
  employmentType: "Contract",
  consent: "yes",
};
const file = { name: "cv.pdf", type: "application/pdf", size: 120_000 };

describe("validateCv", () => {
  it("accepts a complete submission and normalises input", () => {
    const { data, errors } = validateCv({ ...valid, fullName: "  Priya   Sharma " }, file);
    expect(errors).toEqual({});
    expect(data.fullName).toBe("Priya Sharma");
    expect(data.email).toBe("priya@example.com");
    expect(data.consent).toBe(true);
  });

  it("requires every field and consent", () => {
    const { errors } = validateCv({}, null);
    expect(Object.keys(errors).sort()).toEqual(
      ["consent", "cv", "email", "employmentType", "experience", "fullName", "location", "phone", "specialisation"].sort(),
    );
  });

  it("only accepts values from the option lists", () => {
    const { errors } = validateCv({ ...valid, specialisation: "Hacking", experience: "99", employmentType: "Temp" }, file);
    expect(errors.specialisation).toBeDefined();
    expect(errors.experience).toBeDefined();
    expect(errors.employmentType).toBeDefined();
  });

  it("rejects bad names, emails and phone numbers", () => {
    expect(validateCv({ ...valid, fullName: "<script>" }, file).errors.fullName).toBeDefined();
    expect(validateCv({ ...valid, email: "not-an-email" }, file).errors.email).toBeDefined();
    expect(validateCv({ ...valid, phone: "12" }, file).errors.phone).toBeDefined();
    expect(validateCv({ ...valid, phone: "+44 (0) 7700-900123" }, file).errors.phone).toBeUndefined();
  });

  it("lists every SAP area from the brief", () => {
    for (const area of ["SAP S/4HANA", "SAP HANA", "SAP BTP", "SAP FI/CO", "SAP SD", "SAP MM", "SAP PP", "SAP EWM", "SAP HCM", "SAP CRM", "SAP SCM", "SAP QM", "SAP PM", "SAP PS", "SAP BI/BW", "SAP ABAP", "SAP Fiori/UI5", "SAP Basis"]) {
      expect(specialisationOptions).toContain(area);
    }
  });
});

describe("validateCvFile", () => {
  it("accepts PDF, DOC and DOCX", () => {
    expect(validateCvFile({ name: "a.PDF", type: "application/pdf", size: 10 })).toBeUndefined();
    expect(validateCvFile({ name: "a.doc", type: "application/msword", size: 10 })).toBeUndefined();
    expect(validateCvFile({ name: "a.docx", type: "", size: 10 })).toBeUndefined();
  });

  it("rejects other types, mismatched types and large files", () => {
    expect(validateCvFile({ name: "a.exe", type: "application/x-msdownload", size: 10 })).toBeDefined();
    expect(validateCvFile({ name: "a.pdf.html", type: "text/html", size: 10 })).toBeDefined();
    expect(validateCvFile({ name: "a.pdf", type: "text/html", size: 10 })).toBeDefined();
    expect(validateCvFile({ name: "a.pdf", type: "application/pdf", size: CV_MAX_BYTES + 1 })).toMatch(/4 MB/);
    expect(validateCvFile({ name: "a.pdf", type: "application/pdf", size: 0 })).toBeDefined();
  });
});
