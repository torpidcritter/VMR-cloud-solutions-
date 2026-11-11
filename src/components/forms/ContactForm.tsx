"use client";

import { useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { describedBy, Field, Honeypot } from "./Field";
import { requirementOptions, serviceOptions, validateEnquiry, type Errors } from "@/lib/forms";
import { services } from "@/content/services";
import { site } from "@/content/site";

type Status = "idle" | "sending" | "success" | "error";

export function ContactForm() {
  const params = useSearchParams();
  const preset = services.find((s) => s.slug === params.get("service"))?.title ?? "";
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState("");
  const startedAt = useRef(Date.now());
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const { errors: errs } = validateEnquiry(values);
    setErrors(errs);
    setServerError("");
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0];
      (form.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, startedAt: startedAt.current }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setStatus("success");
        form.reset();
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
        <h3 className="mt-5 text-2xl font-bold tracking-tight">Enquiry sent</h3>
        <p className="mt-3 max-w-md leading-relaxed text-ink-soft">
          Thank you for contacting VMR Cloud Solutions. Your enquiry has been received. Our team will get back to you.
        </p>
        <button
          type="button"
          className="btn btn-secondary mt-8"
          onClick={() => {
            startedAt.current = Date.now();
            setStatus("idle");
          }}
        >
          Send another enquiry
        </button>
      </div>
    );
  }

  const sending = status === "sending";

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="relative grid gap-5 sm:grid-cols-2" aria-describedby="form-note">
      <Honeypot />
      <Field id="name" label="Name" required error={errors.name}>
        <input id="name" name="name" autoComplete="name" className="field" aria-invalid={!!errors.name} aria-describedby={describedBy("name", errors.name)} required />
      </Field>
      <Field id="company" label="Company Name" error={errors.company}>
        <input id="company" name="company" autoComplete="organization" className="field" aria-invalid={!!errors.company} aria-describedby={describedBy("company", errors.company)} />
      </Field>
      <Field id="email" label="Business Email" required error={errors.email}>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" className="field" aria-invalid={!!errors.email} aria-describedby={describedBy("email", errors.email)} required />
      </Field>
      <Field id="phone" label="Contact Number" required error={errors.phone}>
        <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" className="field" aria-invalid={!!errors.phone} aria-describedby={describedBy("phone", errors.phone)} required />
      </Field>
      <Field id="service" label="Service Interested In" required error={errors.service}>
        <select id="service" name="service" defaultValue={preset} className="field" aria-invalid={!!errors.service} aria-describedby={describedBy("service", errors.service)} required>
          <option value="" disabled>
            Select a service
          </option>
          {serviceOptions.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Field>
      <Field id="requirement" label="Project Requirements" error={errors.requirement}>
        <select id="requirement" name="requirement" defaultValue="" className="field" aria-invalid={!!errors.requirement} aria-describedby={describedBy("requirement", errors.requirement)}>
          <option value="">Select an option</option>
          {requirementOptions.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Field>
      <Field id="message" label="Message" required error={errors.message} className="sm:col-span-2">
        <textarea
          id="message"
          name="message"
          rows={5}
          className="field resize-y"
          placeholder="Tell us about your requirement, timelines and anything else that will help us respond."
          aria-invalid={!!errors.message}
          aria-describedby={describedBy("message", errors.message)}
          required
        />
      </Field>

      {serverError && (
        <div role="alert" className="rounded-xl border border-accent-500/30 bg-accent-500/5 p-4 text-sm text-ink-soft sm:col-span-2">
          {serverError} You can also email us at{" "}
          <a className="font-semibold text-brand-700 underline" href={`mailto:${site.email.general}`}>
            {site.email.general}
          </a>{" "}
          or call{" "}
          <a className="font-semibold text-brand-700 underline" href={site.phone.mobile.href}>
            {site.phone.mobile.display}
          </a>
          .
        </div>
      )}

      <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p id="form-note" className="text-xs leading-relaxed text-muted sm:max-w-sm">
          Fields marked * are required. We use your details only to respond to your enquiry. See our{" "}
          <a href="/privacy-policy" className="underline underline-offset-2">
            Privacy Policy
          </a>
          .
        </p>
        <button type="submit" disabled={sending} className="btn btn-primary w-full disabled:cursor-wait disabled:opacity-80 sm:w-auto">
          {sending ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" /> Sending…
            </>
          ) : (
            <>
              Send Enquiry <ArrowRight aria-hidden className="size-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
