/**
 * CV submission rules, shared by the browser (instant feedback) and the
 * /api/cv route (authoritative validation).
 */
import { sapSpecialisations } from "@/content/recruitment";

/**
 * 4 MB. Vercel rejects request bodies above 4.5 MB, so anything larger
 * would fail before reaching our code.
 */
export const CV_MAX_BYTES = 4 * 1024 * 1024;
export const CV_MAX_LABEL = "4 MB";

export const CV_EXTENSIONS = ["pdf", "doc", "docx"] as const;
export type CvExtension = (typeof CV_EXTENSIONS)[number];

export const CV_MIME: Record<CvExtension, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const CV_ACCEPT = [".pdf", ".doc", ".docx", ...Object.values(CV_MIME)].join(",");

export const specialisationOptions = sapSpecialisations;

export const cvExperienceOptions = ["Less than 2 years", "2–5 years", "5–8 years", "8–12 years", "12–15 years", "15+ years"];

export const employmentTypeOptions = ["Contract", "Permanent", "Both"] as const;

/** Bump when the consent wording changes; stored with every submission. */
export const CONSENT_VERSION = "2026-11-11";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[()\-\s\d]{7,20}$/;
// Letters (any language), spaces and common name punctuation.
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}' .\-]*$/u;

export type CvErrors = Record<string, string>;

export type CvFields = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  specialisation: string;
  experience: string;
  employmentType: string;
  consent: boolean;
};

export type FileLike = { size: number; type: string; name: string };

const str = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

export function fileExtension(name: string): CvExtension | null {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext && (CV_EXTENSIONS as readonly string[]).includes(ext) ? (ext as CvExtension) : null;
}

/** Validates the file's name, size and declared type (content is checked on the server). */
export function validateCvFile(file?: FileLike | null): string | undefined {
  if (!file || file.size === 0) return "Please attach your CV.";
  const ext = fileExtension(file.name);
  if (!ext) return "Please upload a PDF, DOC or DOCX file.";
  // Browsers sometimes send an empty or generic type; only reject a type that contradicts the extension.
  const declared = file.type.toLowerCase();
  if (declared && declared !== "application/octet-stream" && declared !== CV_MIME[ext]) {
    return "The file type doesn't match its extension. Please upload a PDF, DOC or DOCX file.";
  }
  if (file.size > CV_MAX_BYTES) return `Your CV must be ${CV_MAX_LABEL} or smaller.`;
  if (file.name.length > 180) return "Please shorten the file name and try again.";
  return undefined;
}

export function validateCv(input: Record<string, unknown>, file?: FileLike | null) {
  const data: CvFields = {
    fullName: str(input.fullName),
    email: str(input.email).toLowerCase(),
    phone: str(input.phone),
    location: str(input.location),
    specialisation: str(input.specialisation),
    experience: str(input.experience),
    employmentType: str(input.employmentType),
    consent: input.consent === "yes" || input.consent === "on" || input.consent === true,
  };
  const errors: CvErrors = {};

  if (data.fullName.length < 2) errors.fullName = "Please enter your full name.";
  else if (data.fullName.length > 100) errors.fullName = "Name is too long (maximum 100 characters).";
  else if (!NAME_RE.test(data.fullName)) errors.fullName = "Please use letters only in your name.";

  if (!EMAIL_RE.test(data.email) || data.email.length > 254) errors.email = "Please enter a valid email address.";

  const digits = data.phone.replace(/\D/g, "").length;
  if (!PHONE_RE.test(data.phone) || digits < 7 || digits > 15) errors.phone = "Please enter a valid phone number, including the country code.";

  if (data.location.length < 2) errors.location = "Please enter your current location.";
  else if (data.location.length > 100) errors.location = "Location is too long (maximum 100 characters).";

  if (!specialisationOptions.includes(data.specialisation)) errors.specialisation = "Please choose your main SAP specialisation.";
  if (!cvExperienceOptions.includes(data.experience)) errors.experience = "Please choose your total years of experience.";
  if (!(employmentTypeOptions as readonly string[]).includes(data.employmentType)) errors.employmentType = "Please choose contract, permanent or both.";

  const fileError = validateCvFile(file);
  if (fileError) errors.cv = fileError;

  if (!data.consent) errors.consent = "Please confirm you agree to us processing your details.";

  return { data, errors };
}
