import Image from "next/image";
import Link from "next/link";
import { site } from "@/content/site";

/**
 * The supplied VMR Cloud logo (transparent PNG), shown as-is in both themes:
 * its blues and red read well on white and on the dark navy background.
 */
export function Logo({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Link href="/" aria-label={`${site.name} – Home`} className={`inline-flex shrink-0 items-center ${className}`}>
      <Image
        src="/brand/vmr-cloud-logo.png"
        alt={`${site.brand} – ${site.legalName}`}
        width={624}
        height={115}
        priority={priority}
        sizes="(min-width: 1280px) 330px, (min-width: 640px) 280px, 230px"
        className="h-10 w-auto min-[400px]:h-11 sm:h-[3.25rem] lg:h-12 xl:h-[3.75rem]"
      />
    </Link>
  );
}
