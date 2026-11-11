"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, FileText, Loader2, LockKeyhole, Upload, X } from "lucide-react";
import { describedBy, Field, Honeypot } from "./Field";
import {
  CV_ACCEPT,
  CV_MAX_LABEL,
  cvExperienceOptions,
  employmentTypeOptions,
  specialisationOptions,
  validateCv,
  validateCvFile,
  type CvErrors,
} from "@/lib/cv";
import { site } from "@/content/site";

type Status = "idle" | "uploading" | "success" | "error";

const FIELD_ORDER = ["fullName", "email", "phone", "location", "specialisation", "experience", "employmentType", "cv", "consent"];

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** POST with upload progress (fetch can't report upload progress). */
function send(fd: FormData, onProgress: (pct: number) => void) {
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/cv");
    xhr.responseType = "json";
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolve({ status: xhr.status, body: (xhr.response as Record<string, unknown>) ?? {} });
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.send(fd);
  });
}

export function CvUploadForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<CvErrors>({});
  const [serverError, setServerError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [reference, setReference] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const startedAt = useRef(Date.now());
  const successRef = useRef<HTMLDivElement>(null);

  // Bring the confirmation into view (the form above it can be long on mobile).
  useEffect(() => {
    if (status !== "success" || !successRef.current) return;
    successRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    successRef.current.focus({ preventScroll: true });
  }, [status]);

  function pickFile(f: File | null) {
    setFile(f);
    setErrors((prev) => {
      const next = { ...prev };
      const err = f ? validateCvFile(f) : undefined;
      if (err) next.cv = err;
      else delete next.cv;
      return next;
    });
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    pickFile(e.target.files?.[0] ?? null);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  }

  function clearFile() {
    pickFile(null);
    if (fileInput.current) {
      fileInput.current.value = "";
      fileInput.current.focus();
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const values = Object.fromEntries(Array.from(fd.entries()).filter(([, v]) => typeof v === "string"));
    const { errors: errs } = validateCv(values, file);
    setErrors(errs);
    setServerError("");
    if (Object.keys(errs).length) {
      const first = FIELD_ORDER.find((k) => errs[k]);
      (form.querySelector(`[name="${first}"]`) as HTMLElement | null)?.focus();
      return;
    }
    fd.set("cv", file!);
    fd.set("startedAt", String(startedAt.current));
    setProgress(0);
    setStatus("uploading");
    try {
      const { status: code, body } = await send(fd, setProgress);
      if (code >= 200 && code < 300 && body.ok) {
        setReference(typeof body.reference === "string" ? body.reference : "");
        setStatus("success");
        form.reset();
        setFile(null);
        return;
      }
      if (body.errors && typeof body.errors === "object") setErrors(body.errors as CvErrors);
      setServerError(
        typeof body.error === "string"
          ? body.error
          : code === 413
            ? `Your CV must be ${CV_MAX_LABEL} or smaller.`
            : "Please check the highlighted fields and try again.",
      );
      setStatus("error");
    } catch {
      setServerError("We couldn't reach the server. Please check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div ref={successRef} tabIndex={-1} role="status" aria-live="polite" className="flex flex-col outline-none items-start rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 dark:border-emerald-500/30 dark:bg-emerald-500/10 md:p-10">
        <CheckCircle2 aria-hidden className="size-10 text-emerald-600" strokeWidth={1.75} />
        <h3 className="mt-5 text-2xl font-bold tracking-tight">Thank you, your CV has been received</h3>
        <p className="mt-3 max-w-lg leading-relaxed text-ink-soft">
          Your profile has been stored securely and shared with our SAP recruitment team. We&apos;ll be in touch when a contract or permanent opportunity matches your experience.
        </p>
        {reference && (
          <p className="mt-4 text-sm text-muted">
            Your reference: <span className="font-mono font-semibold text-ink">{reference}</span>
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/sap-expertise" className="btn btn-secondary">
            See the SAP areas we recruit for
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              startedAt.current = Date.now();
              setStatus("idle");
            }}
          >
            Submit another CV
          </button>
        </div>
      </div>
    );
  }

  const uploading = status === "uploading";

  return (
    <form noValidate onSubmit={onSubmit} className="relative grid gap-5 sm:grid-cols-2" aria-busy={uploading}>
      <Honeypot />
      <fieldset disabled={uploading} className="contents">
        <legend className="sr-only">Your details</legend>
        <Field id="cv-name" label="Full Name" required error={errors.fullName}>
          <input id="cv-name" name="fullName" autoComplete="name" maxLength={100} className="field" aria-invalid={!!errors.fullName} aria-describedby={describedBy("cv-name", errors.fullName)} required />
        </Field>
        <Field id="cv-email" label="Email Address" required error={errors.email}>
          <input id="cv-email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} className="field" aria-invalid={!!errors.email} aria-describedby={describedBy("cv-email", errors.email)} required />
        </Field>
        <Field id="cv-phone" label="Phone Number" required error={errors.phone} hint="Include your country code, e.g. +44">
          <input id="cv-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={20} className="field" aria-invalid={!!errors.phone} aria-describedby={describedBy("cv-phone", errors.phone, true)} required />
        </Field>
        <Field id="cv-location" label="Current Location" required error={errors.location} hint="City and country">
          <input id="cv-location" name="location" autoComplete="address-level2" maxLength={100} className="field" aria-invalid={!!errors.location} aria-describedby={describedBy("cv-location", errors.location, true)} required />
        </Field>
        <Field id="cv-spec" label="SAP Specialisation / Module" required error={errors.specialisation}>
          <select id="cv-spec" name="specialisation" defaultValue="" className="field" aria-invalid={!!errors.specialisation} aria-describedby={describedBy("cv-spec", errors.specialisation)} required>
            <option value="" disabled>
              Select your main area
            </option>
            {specialisationOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field id="cv-exp" label="Total Years of Experience" required error={errors.experience}>
          <select id="cv-exp" name="experience" defaultValue="" className="field" aria-invalid={!!errors.experience} aria-describedby={describedBy("cv-exp", errors.experience)} required>
            <option value="" disabled>
              Select experience
            </option>
            {cvExperienceOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset
        disabled={uploading}
        className="sm:col-span-2"
        aria-describedby={errors.employmentType ? "cv-type-error" : undefined}
        aria-invalid={!!errors.employmentType}
      >
        <legend className="field-label">
          Preferred Employment Type<span aria-hidden className="ml-0.5 text-accent-600">*</span>
        </legend>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {employmentTypeOptions.map((o) => (
            <label
              key={o}
              className="relative flex min-h-12 cursor-pointer items-center justify-center rounded-[0.65rem] border border-line-strong bg-card px-3 text-sm font-semibold text-ink-soft transition-colors hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700 has-[:focus-visible]:shadow-[0_0_0_4px_rgba(66,125,244,0.2)]"
            >
              <input type="radio" name="employmentType" value={o} className="sr-only" required />
              {o}
            </label>
          ))}
        </div>
        {errors.employmentType && (
          <p id="cv-type-error" className="field-error" role="alert">
            {errors.employmentType}
          </p>
        )}
      </fieldset>

      <div className="sm:col-span-2">
        <label htmlFor="cv-file" className="field-label">
          CV / Resume<span aria-hidden className="ml-0.5 text-accent-600">*</span>
        </label>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!uploading) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={uploading ? undefined : onDrop}
          className={`relative rounded-xl border border-dashed px-5 py-6 transition-colors focus-within:border-brand-500 focus-within:shadow-[0_0_0_4px_rgba(66,125,244,0.15)] ${
            errors.cv ? "border-accent-600 bg-accent-500/[0.03]" : dragging ? "border-brand-500 bg-brand-50" : "border-line-strong bg-surface hover:border-brand-300"
          }`}
        >
          {file ? (
            <div className="flex items-center gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-card text-brand-600 shadow-[var(--shadow-card)]">
                <FileText aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{file.name}</span>
                <span className="block text-xs text-muted">{formatSize(file.size)}</span>
              </span>
              {!uploading && (
                <button type="button" onClick={clearFile} className="relative z-10 grid size-9 place-items-center rounded-full text-muted hover:bg-card hover:text-ink" aria-label={`Remove ${file.name}`}>
                  <X aria-hidden className="size-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <Upload aria-hidden className="size-6 text-brand-600" />
              <p className="text-sm text-ink-soft">
                <span className="font-semibold text-brand-700">Choose a file</span> or drag it here
              </p>
              <p className="text-xs text-muted">PDF, DOC or DOCX · up to {CV_MAX_LABEL}</p>
            </div>
          )}
          <input
            ref={fileInput}
            id="cv-file"
            name="cv"
            type="file"
            accept={CV_ACCEPT}
            onChange={onFile}
            disabled={uploading}
            className={`absolute inset-0 cursor-pointer opacity-0 ${file ? "pointer-events-none" : ""}`}
            aria-invalid={!!errors.cv}
            aria-describedby={errors.cv ? "cv-file-error" : "cv-file-hint"}
            required
          />
        </div>
        {errors.cv ? (
          <p id="cv-file-error" className="field-error" role="alert">
            {errors.cv}
          </p>
        ) : (
          <p id="cv-file-hint" className="mt-1.5 text-xs text-muted">
            Accepted: PDF, DOC or DOCX up to {CV_MAX_LABEL}. Files with macros or scripts are rejected.
          </p>
        )}
      </div>

      <div className="sm:col-span-2">
        <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 text-sm leading-relaxed text-ink-soft ${errors.consent ? "border-accent-600" : "border-line"}`}>
          <input
            type="checkbox"
            name="consent"
            value="yes"
            disabled={uploading}
            className="mt-0.5 size-[1.1rem] shrink-0 accent-[var(--color-btn)]"
            aria-invalid={!!errors.consent}
            aria-describedby={errors.consent ? "cv-consent-error" : undefined}
            required
          />
          <span>
            I consent to {site.legalName} storing and processing my personal information and CV to assess my suitability for SAP roles and to contact me about opportunities, in line with the UK GDPR and the{" "}
            <Link href="/privacy-policy#candidates" className="font-semibold text-brand-700 underline underline-offset-2">
              Privacy Policy
            </Link>
            . I can withdraw consent and ask for my data to be deleted at any time.
            <span aria-hidden className="ml-0.5 text-accent-600">*</span>
          </span>
        </label>
        {errors.consent && (
          <p id="cv-consent-error" className="field-error" role="alert">
            {errors.consent}
          </p>
        )}
      </div>

      {uploading && (
        <div className="sm:col-span-2" aria-live="polite">
          <div className="flex items-center justify-between text-xs font-medium text-ink-soft">
            <span>{progress < 100 ? "Uploading your CV…" : "Checking and saving securely…"}</span>
            <span>{progress}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
          >
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-sky-brand transition-[width] duration-200" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {serverError && (
        <div role="alert" className="rounded-xl border border-accent-500/30 bg-accent-500/5 p-4 text-sm text-ink-soft sm:col-span-2">
          {serverError} If the problem continues, email your CV to{" "}
          <a className="font-semibold text-brand-700 underline" href={`mailto:${site.email.hr}`}>
            {site.email.hr}
          </a>
          .
        </div>
      )}

      <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted sm:max-w-sm">
          <LockKeyhole aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Your CV is stored privately and only shared with our recruitment team.
        </p>
        <button type="submit" disabled={uploading} className="btn btn-primary w-full disabled:cursor-wait disabled:opacity-80 sm:w-auto">
          {uploading ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" /> Uploading…
            </>
          ) : (
            <>
              Submit Your CV <ArrowRight aria-hidden className="size-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
