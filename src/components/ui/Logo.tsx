import Image from "next/image";
import Link from "next/link";
import { site } from "@/content/site";

/** The supplied VMR Cloud logo, unaltered apart from a transparent background. */
export function Logo({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Link href="/" aria-label={`${site.name} – Home`} className={`inline-flex shrink-0 items-center rounded-xl transition-colors dark:bg-white dark:px-3 dark:py-1.5 ${className}`}>
      <Image
        src="/brand/vmr-cloud-logo.png"
        alt={`${site.brand} – ${site.legalName}`}
        width={953}
        height={176}
        priority={priority}
        sizes="(min-width: 1280px) 260px, 240px"
        className="h-9 w-auto min-[400px]:h-10 sm:h-11 xl:h-12"
      />
    </Link>
  );
}
