import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

// Upgrading a database that already holds data from the first release.
const dir = mkdtempSync(path.join(tmpdir(), "vmr-mig-"));
process.env.DB_DRIVER = "pglite";
process.env.PGLITE_DIR = dir;

const { MIGRATIONS } = await import("@/lib/db/migrations");

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("migration 2 on existing data", () => {
  it("maps old statuses, links history to candidates and keeps every row", async () => {
    const old = new PGlite(dir);
    await old.query(`CREATE TABLE schema_migrations (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    for (const s of MIGRATIONS[0].statements) await old.query(s);
    await old.query(`INSERT INTO schema_migrations (version) VALUES (1)`);
    const [u] = (await old.query<{ id: string }>(`INSERT INTO admin_users (email, name, role, password_hash) VALUES ('admin@example.test', 'Test Admin', 'super_admin', 'x') RETURNING id`)).rows;
    const [c] = (await old.query<{ id: string }>(`INSERT INTO candidates (email, full_name) VALUES ('test.candidate@example.test', 'Test Candidate') RETURNING id`)).rows;
    const statuses = ["new", "under_review", "interview", "offered", "hired"];
    for (const s of statuses) await old.query(`INSERT INTO applications (candidate_id, source, position, status) VALUES ($1, 'careers', 'SAP Consultant', $2)`, [c.id, s]);
    const [a] = (await old.query<{ id: string }>(`SELECT id FROM applications WHERE status = 'under_review'`)).rows;
    await old.query(`INSERT INTO application_events (application_id, user_id, kind, from_status, to_status) VALUES ($1, $2, 'status', 'new', 'under_review')`, [a.id, u.id]);
    await old.query(`INSERT INTO application_events (application_id, user_id, kind, body) VALUES ($1, $2, 'note', 'Old note')`, [a.id, u.id]);
    await old.query(`INSERT INTO job_openings (slug, title, salary_range) VALUES ('old-job', 'Old job', '₹10 LPA')`);
    await old.query(`INSERT INTO job_openings (slug, title, client_name) VALUES ('old-a', 'Old A', ' Old Client Test '), ('old-b', 'Old B', 'old client test')`);
    await old.close();

    const { db } = await import("@/lib/db/client");
    const conn = await db();
    const versions = await conn.query<{ version: number }>(`SELECT version FROM schema_migrations ORDER BY version`);
    expect(versions.map((v) => Number(v.version))).toEqual([1, 2, 3, 4, 5, 6]);

    const apps = await conn.query<{ status: string; stage_changed_at: string | null; assigned_to: string | null }>(`SELECT status, stage_changed_at, assigned_to FROM applications ORDER BY number`);
    expect(apps.map((r) => r.status)).toEqual(["new", "screening", "interview_scheduled", "offer_released", "hired"]);
    expect(apps.every((r) => r.stage_changed_at && r.assigned_to === null)).toBe(true);

    const events = await conn.query<{ kind: string; to_status: string | null; candidate_id: string }>(`SELECT kind, to_status, candidate_id FROM application_events ORDER BY created_at`);
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.candidate_id === c.id)).toBe(true);
    expect(events.find((e) => e.kind === "status")?.to_status).toBe("screening");

    const [cand] = await conn.query<{ priority: string; tags: string[]; skills: string[] }>(`SELECT priority, tags, skills FROM candidates`);
    expect(cand).toMatchObject({ priority: "normal", tags: [], skills: [] });
    const [job] = await conn.query<{ vacancies: number; salary_visible: boolean }>(`SELECT vacancies, salary_visible FROM job_openings WHERE slug = 'old-job'`);
    expect(job).toMatchObject({ vacancies: 1, salary_visible: true });
    // Migration 5: each distinct client name on an opening became one client, and the openings point at it.
    const linked = await conn.query<{ slug: string; client: string | null }>(`SELECT o.slug, c.name AS client FROM job_openings o LEFT JOIN clients c ON c.id = o.client_id ORDER BY o.slug`);
    expect(linked.map((r) => [r.slug, r.client?.toLowerCase() ?? null])).toEqual([["old-a", "old client test"], ["old-b", "old client test"], ["old-job", null]]);
    expect((await conn.query(`SELECT 1 FROM clients`)).length).toBe(1);
    expect((await conn.query(`SELECT 1 FROM email_templates`)).length).toBe(5);

    // The old statuses can no longer be written.
    await expect(conn.query(`UPDATE applications SET status = 'interview'`)).rejects.toThrow();
  });
});
