import "server-only";
import { db } from "@/lib/db/client";
import { openingTerms, pgTermRegex, scoreMatch, termsIn, type Match, type MatchCandidate, type MatchOpening } from "@/lib/matching";
import { getOpening } from "./openings";

const isUuid = (v?: string | null) => !!v && /^[0-9a-f-]{36}$/i.test(v);

const CAND = `c.id, c.full_name, c.skills, c.specialisation, c.current_title, c.experience, c.experience_years::float8 AS experience_years,
  c.location, c.preferred_location, c.availability, c.notice_period, c.priority, c.last_contacted_at`;

export type CandidateMatch = MatchCandidate & {
  id: string;
  full_name: string;
  priority: string;
  last_contacted_at: string | null;
  match: Match;
};

/**
 * Talent Bank candidates for an opening, best first. Candidates who already
 * applied to it are left out (they are in its pipeline) and counted.
 */
export async function matchCandidatesForOpening(openingId: string, limit = 20) {
  const o = await getOpening(openingId);
  if (!o) return null;
  const terms = openingTerms(o);
  if (!terms.length) return { opening: o, terms, matches: [] as CandidateMatch[], applied: 0, considered: 0 };
  const conn = await db();
  const regex = terms.map(pgTermRegex);
  const rows = await conn.query<MatchCandidate & { id: string; full_name: string; priority: string; last_contacted_at: string | null; resume_terms: string[]; applied: boolean }>(
    `SELECT ${CAND},
            ARRAY(SELECT t.term FROM unnest($1::text[], $2::text[]) AS t(term, rx)
                   WHERE EXISTS (SELECT 1 FROM candidate_files f WHERE f.candidate_id = c.id AND f.text_content ~* t.rx)
                      OR EXISTS (SELECT 1 FROM applications a WHERE a.candidate_id = c.id AND a.resume_text ~* t.rx)) AS resume_terms,
            EXISTS (SELECT 1 FROM applications a WHERE a.candidate_id = c.id AND a.opening_id = $3) AS applied
       FROM candidates c
      WHERE EXISTS (SELECT 1 FROM unnest(c.skills || ARRAY[c.specialisation, c.current_title]) s, unnest($2::text[]) rx WHERE s ~* rx)
         OR EXISTS (SELECT 1 FROM candidate_files f, unnest($2::text[]) rx WHERE f.candidate_id = c.id AND f.text_content ~* rx)
         OR EXISTS (SELECT 1 FROM applications a, unnest($2::text[]) rx WHERE a.candidate_id = c.id AND a.resume_text ~* rx)
      ORDER BY c.updated_at DESC LIMIT 500`,
    [terms, regex, o.id],
  );
  const applied = rows.filter((r) => r.applied).length;
  const matches = rows
    .filter((r) => !r.applied)
    .map((r) => ({ ...r, experience_years: r.experience_years === null ? null : Number(r.experience_years), match: scoreMatch(o, r, r.resume_terms) }))
    .filter((r) => r.match.score > 0)
    .sort((a, b) => b.match.score - a.match.score || a.full_name.localeCompare(b.full_name))
    .slice(0, limit);
  return { opening: o, terms, matches, applied, considered: rows.length };
}

export type OpeningMatch = { id: string; title: string; status: string; location: string; applied: boolean; match: Match };

/** Open roles that suit a candidate, best first, with the reasons. */
export async function matchOpeningsForCandidate(candidateId: string, limit = 6) {
  if (!isUuid(candidateId)) return [];
  const conn = await db();
  const [c] = await conn.query<MatchCandidate & { resume: string }>(
    `SELECT ${CAND},
            left(concat_ws(' ', (SELECT string_agg(f.text_content, ' ') FROM candidate_files f WHERE f.candidate_id = c.id),
                                (SELECT string_agg(a.resume_text, ' ') FROM applications a WHERE a.candidate_id = c.id)), 300000) AS resume
       FROM candidates c WHERE c.id = $1`,
    [candidateId],
  );
  if (!c) return [];
  const openings = await conn.query<MatchOpening & { id: string; status: string; applied: boolean }>(
    `SELECT o.id, o.title, o.status, o.sap_module, o.skills, o.location, o.work_mode, o.experience, o.min_experience_years::float8 AS min_experience_years,
            EXISTS (SELECT 1 FROM applications a WHERE a.opening_id = o.id AND a.candidate_id = $1) AS applied
       FROM job_openings o WHERE o.status IN ('published','paused') ORDER BY o.updated_at DESC LIMIT 200`,
    [candidateId],
  );
  const cand = { ...c, experience_years: c.experience_years === null ? null : Number(c.experience_years) };
  return openings
    .map((o) => {
      const mo = { ...o, min_experience_years: o.min_experience_years === null ? null : Number(o.min_experience_years) };
      return { id: o.id, title: o.title, status: o.status, location: o.location, applied: o.applied, match: scoreMatch(mo, cand, termsIn(c.resume ?? "", openingTerms(mo))) };
    })
    .filter((m) => m.match.score > 0)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, limit);
}

/**
 * Puts a candidate forward for an opening as a new application, owned by the
 * recruiter who did it. Does nothing if they are already in its pipeline.
 */
export async function addCandidateToOpening(candidateId: string, openingId: string, userId: string): Promise<{ id: string; created: boolean } | null> {
  if (!isUuid(candidateId) || !isUuid(openingId)) return null;
  const conn = await db();
  const [made] = await conn.query<{ id: string }>(
    `WITH o AS (SELECT id, title FROM job_openings WHERE id = $2 AND status <> 'closed'),
          c AS (SELECT id, experience FROM candidates WHERE id = $1),
          ins AS (
            INSERT INTO applications (candidate_id, opening_id, source, position, experience, assigned_to)
            SELECT c.id, o.id, 'talent', o.title, c.experience, $3 FROM c, o
             WHERE NOT EXISTS (SELECT 1 FROM applications a WHERE a.candidate_id = $1 AND a.opening_id = $2)
            RETURNING id, candidate_id
          ),
          ev AS (
            INSERT INTO application_events (application_id, candidate_id, user_id, kind, body)
            SELECT id, candidate_id, $3, 'note', 'Put forward from the Talent Bank' FROM ins
          )
     SELECT id FROM ins`,
    [candidateId, openingId, userId],
  );
  if (made) return { id: made.id, created: true };
  const [existing] = await conn.query<{ id: string }>(`SELECT id FROM applications WHERE candidate_id = $1 AND opening_id = $2 ORDER BY submitted_at DESC LIMIT 1`, [candidateId, openingId]);
  return existing ? { id: existing.id, created: false } : null;
}
