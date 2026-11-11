"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, FileText, Loader2, Upload, X } from "lucide-react";
import { describedBy, Field, Honeypot } from "./Field";
import { experienceOptions, positionOptions, validateApplication, type Errors } from "@/lib/forms";
import { site } from "@/content/site";

type Status = "idle" | "sending" | "success" | "error";

export function CareerForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const startedAt = useRef(Date.now());

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      const { errors: errs } = validateApplication({}, f);
      setErrors((prev) => {
        const next = { ...prev };
        if (errs.resume) next.resume = errs.resume;
        else delete next.resume;
        return next;
      });
    }
  }

  function clearFile() {
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const values = Object.fromEntries(Array.from(fd.entries()).filter(([, v]) => typeof v === "string"));
    const { errors: errs } = validateApplication(values, file);
    setErrors(errs);
    setServerError("");
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0];
      (form.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }
    fd.set("startedAt", String(startedAt.current));
    setStatus("sending");
    try {
      const res = await fetch("/api/careers", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setStatus("success");
        form.reset();
        clearFile();
        return;
      }
      if (json.errors) setErrors(json.errors);
      setServerError(json.error || "Please check the highlighted fields and try again.");
      setStatus("error");
    } catch {
      setServerError("We couldn't reach the server. Please check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div role="status" className="flex flex-col items-start rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 md:p-10">
        <CheckCircle2 aria-hidden className="size-10 text-emerald-600" strokeWidth={1.75} />
        <h3 className="mt-5 text-2xl font-bold tracking-tight">Application received</h3>
        <p className="mt-3 max-w-md leading-relaxed text-ink-soft">
          Thank you for your interest in VMR Cloud Solutions. Our HR team will review your application and contact you if your profile matches a current opportunity.
        </p>
        <button
          type="button"
          className="btn btn-secondary mt-8"
          onClick={() => {
            startedAt.current = Date.now();
            setStatus("idle");
          }}
        >
          Submit another application
        </button>
      </div>
    );
  }

  const sending = status === "sending";

  return (
    <form noValidate onSubmit={onSubmit} className="relative grid gap-5 sm:grid-cols-2" encType="multipart/form-data">
      <Honeypot />
      <Field id="fullName" label="Full Name" required error={errors.fullName}>
        <input id="fullName" name="fullName" autoComplete="name" className="field" aria-invalid={!!errors.fullName} aria-describedby={describedBy("fullName", errors.fullName)} required />
      </Field>
      <Field id="c-email" label="Email Address" required error={errors.email}>
        <input id="c-email" name="email" type="email" autoComplete="email" inputMode="email" className="field" aria-invalid={!!errors.email} aria-describedby={describedBy("c-email", errors.email)} required />
      </Field>
      <Field id="c-phone" label="Phone Number" required error={errors.phone}>
        <input id="c-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" className="field" aria-invalid={!!errors.phone} aria-describedby={describedBy("c-phone", errors.phone)} required />
      </Field>
      <Field id="position" label="Position Applied For" required error={errors.position}>
        <select id="position" name="position" defaultValue="" className="field" aria-invalid={!!errors.position} aria-describedby={describedBy("position", errors.position)} required>
          <option value="" disabled>
            Select a position
          </option>
          {positionOptions.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Field>
      <Field id="experience" label="Years of Experience" required error={errors.experience}>
        <select id="experience" name="experience" defaultValue="" className="field" aria-invalid={!!errors.experience} aria-describedby={describedBy("experience", errors.experience)} required>
          <option value="" disabled>
            Select experience
          </option>
          {experienceOptions.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Field>

      <Field id="resume" label="Resume" required error={errors.resume} hint="PDF or Word, up to 5 MB">
        <div
          className={`relative flex min-h-12 items-center gap-3 rounded-[0.65rem] border border-dashed px-3 py-2 transition-colors focus-within:border-brand-500 focus-within:shadow-[0_0_0_4px_rgba(66,125,244,0.15)] hover:border-brand-300 ${
            errors.resume ? "border-accent-600" : "border-line-strong"
          }`}
        >
          {file ? (
            <>
              <FileText aria-hidden className="size-5 shrink-0 text-brand-600" />
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{file.name}</span>
              <button type="button" onClick={clearFile} className="relative z-10 grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink" aria-label="Remove file">
                <X aria-hidden className="size-4" />
              </button>
            </>
          ) : (
            <>
              <Upload aria-hidden className="size-5 shrink-0 text-muted" />
              <span className="text-sm text-muted">
                <span className="font-semibold text-brand-700">Choose a file</span> to upload
              </span>
            </>
          )}
          <input
            ref={fileInput}
            id="resume"
            name="resume"
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={onFile}
            className={`absolute inset-0 cursor-pointer opacity-0 ${file ? "pointer-events-none" : ""}`}
            aria-invalid={!!errors.resume}
            aria-describedby={describedBy("resume", errors.resume, true)}
            required
          />
        </div>
      </Field>

      <Field id="c-message" label="Message" error={errors.message} className="sm:col-span-2">
        <textarea
          id="c-message"
          name="message"
          rows={4}
          className="field resize-y"
          placeholder="Tell us briefly about your skills and the kind of role you're looking for."
          aria-invalid={!!errors.message}
          aria-describedby={describedBy("c-message", errors.message)}
        />
      </Field>

      {serverError && (
        <div role="alert" className="rounded-xl border border-accent-500/30 bg-accent-500/5 p-4 text-sm text-ink-soft sm:col-span-2">
          {serverError} You can also email your resume to{" "}
          <a className="font-semibold text-brand-700 underline" href={`mailto:${site.email.hr}`}>
            {site.email.hr}
          </a>
          .
        </div>
      )}

      <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-muted sm:max-w-sm">
          Your details are used only for recruitment. See our{" "}
          <a href="/privacy-policy" className="underline underline-offset-2">
            Privacy Policy
          </a>
          .
        </p>
        <button type="submit" disabled={sending} className="btn btn-primary w-full disabled:cursor-wait disabled:opacity-80 sm:w-auto">
          {sending ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" /> Submitting…
            </>
          ) : (
            <>
              Submit Your Resume <ArrowRight aria-hidden className="size-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
