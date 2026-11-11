/**
 * Form definitions shared by the browser (instant validation) and the
 * server (authoritative validation). Keep both in sync by using only this.
 */
import { careerAreas } from "@/content/company";
import { services } from "@/content/services";

export const serviceOptions = [...services.map((s) => s.title), "Other / Not sure"];

export const requirementOptions = [
  "New project or solution",
  "Enhancing an existing system",
  "Team augmentation / staffing",
  "Ongoing support & maintenance",
  "Consultation / advice",
  "Other",
];

export const positionOptions = [...careerAreas, "Software Development Internship", "Other"];

export const experienceOptions = ["Fresher / Student", "Less than 1 year", "1–3 years", "3–5 years", "5–8 years", "8+ years"];

export const RESUME_MAX_BYTES = 5 * 1024 * 1024;
export const RESUME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\-\s\d]{7,20}$/;

export type Errors = Record<string, string>;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function validateEnquiry(input: Record<string, unknown>) {
  const data = {
    name: str(input.name),
    company: str(input.company),
    email: str(input.email),
    phone: str(input.phone),
    service: str(input.service),
    requirement: str(input.requirement),
    message: str(input.message),
  };
  const errors: Errors = {};
  if (data.name.length < 2) errors.name = "Please enter your name.";
  if (data.name.length > 100) errors.name = "Name is too long.";
  if (data.company.length > 120) errors.company = "Company name is too long.";
  if (!EMAIL_RE.test(data.email)) errors.email = "Please enter a valid email address.";
  if (!PHONE_RE.test(data.phone)) errors.phone = "Please enter a valid contact number.";
  if (data.service && !serviceOptions.includes(data.service)) errors.service = "Please choose a service from the list.";
  if (!data.service) errors.service = "Please choose the service you're interested in.";
  if (data.requirement && !requirementOptions.includes(data.requirement)) errors.requirement = "Please choose an option from the list.";
  if (data.message.length < 10) errors.message = "Please tell us a little more (at least 10 characters).";
  if (data.message.length > 4000) errors.message = "Message is too long (maximum 4000 characters).";
  return { data, errors };
}

export function validateApplication(input: Record<string, unknown>, file?: { size: number; type: string; name: string } | null) {
  const data = {
    fullName: str(input.fullName),
    email: str(input.email),
    phone: str(input.phone),
    position: str(input.position),
    experience: str(input.experience),
    message: str(input.message),
  };
  const errors: Errors = {};
  if (data.fullName.length < 2) errors.fullName = "Please enter your full name.";
  if (data.fullName.length > 100) errors.fullName = "Name is too long.";
  if (!EMAIL_RE.test(data.email)) errors.email = "Please enter a valid email address.";
  if (!PHONE_RE.test(data.phone)) errors.phone = "Please enter a valid phone number.";
  if (!positionOptions.includes(data.position)) errors.position = "Please choose the position you're applying for.";
  if (!experienceOptions.includes(data.experience)) errors.experience = "Please choose your experience.";
  if (data.message.length > 3000) errors.message = "Message is too long (maximum 3000 characters).";
  if (!file || file.size === 0) errors.resume = "Please attach your resume.";
  else if (file.size > RESUME_MAX_BYTES) errors.resume = "Resume must be 5 MB or smaller.";
  else if (!RESUME_TYPES[file.type] && !/\.(pdf|docx?)$/i.test(file.name)) errors.resume = "Please upload a PDF or Word document.";
  return { data, errors };
}
