import type { ReactNode } from "react";

type Tone = "white" | "surface" | "dark";

const tones: Record<Tone, string> = {
  white: "bg-white",
  surface: "bg-surface",
  dark: "on-dark bg-navy-900 text-white",
};

export function Section({
  children,
  tone = "white",
  className = "",
  id,
  labelledBy,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  id?: string;
  labelledBy?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`relative section-y ${tones[tone]} ${className}`}>
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  text,
  id,
  align = "left",
  dark = false,
  className = "",
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  text?: ReactNode;
  id?: string;
  align?: "left" | "center";
  dark?: boolean;
  className?: string;
  as?: "h1" | "h2";
}) {
  const center = align === "center";
  return (
    <div data-reveal className={`${center ? "mx-auto text-center" : ""} max-w-3xl ${className}`}>
      {eyebrow && <p className={`eyebrow ${center ? "justify-center" : ""}`}>{eyebrow}</p>}
      <Tag id={id} className={`${Tag === "h1" ? "t-1" : "t-2"} mt-4 ${dark ? "!text-white" : ""}`}>
        {title}
      </Tag>
      {text && <p className={`lead mt-5 ${dark ? "!text-slate-300" : ""}`}>{text}</p>}
    </div>
  );
}
