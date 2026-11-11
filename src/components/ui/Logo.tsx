import Image from "next/image";
import Link from "next/link";
import { site } from "@/content/site";

/** The supplied VMR Cloud logo, unaltered apart from a transparent background. */
export function Logo({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Link href="/" aria-label={`${site.name} – Home`} className={`inline-flex shrink-0 items-center ${className}`}>
      <Image
        src="/brand/vmr-cloud-logo.png"
        alt={`${site.brand} – ${site.legalName}`}
        width={953}
        height={176}
        priority={priority}
        sizes="200px"
        className="h-8 w-auto sm:h-9"
      />
    </Link>
  );
}
