import "server-only";
import { isDbConfigured } from "@/lib/db/client";

/**
 * Website forms save to the admin database when one is connected. A database
 * problem must never lose a submission that was emailed or stored, so
 * failures are logged and the caller decides what to tell the visitor.
 */
export async function saveSubmission<T>(label: string, save: () => Promise<T>): Promise<T | null> {
  if (!isDbConfigured()) return null;
  try {
    return await save();
  } catch (err) {
    console.error(`[${label}] database save failed`, err instanceof Error ? err.message : err);
    return null;
  }
}
