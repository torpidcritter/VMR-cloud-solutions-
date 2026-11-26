/**
 * Database schema, applied in order on first use (see client.ts).
 * Never edit a released migration: add a new one with the next version.
 * Version 1 is idempotent statement by statement; every later version runs
 * as one transaction (all or nothing), so it may use plain ALTER TABLE.
 */
export const MIGRATIONS: { version: number; statements: string[] }[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS admin_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        name text NOT NULL,
        role text NOT NULL CHECK (role IN ('super_admin','recruiter','sales','viewer')),
        password_hash text NOT NULL,
        active boolean NOT NULL DEFAULT true,
        must_change_password boolean NOT NULL DEFAULT false,
        failed_attempts int NOT NULL DEFAULT 0,
        locked_until timestamptz,
        last_login_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS admin_sessions (
        id text PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        ip text,
        user_agent text
      )`,
      `CREATE INDEX IF NOT EXISTS admin_sessions_user ON admin_sessions(user_id)`,
      `CREATE TABLE IF NOT EXISTS job_openings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug text NOT NULL UNIQUE,
        title text NOT NULL,
        sap_module text NOT NULL DEFAULT '',
        client_name text NOT NULL DEFAULT '',
        public_client_label text NOT NULL DEFAULT '',
        location text NOT NULL DEFAULT '',
        work_mode text NOT NULL DEFAULT 'Hybrid',
        experience text NOT NULL DEFAULT '',
        employment_type text NOT NULL DEFAULT 'Permanent',
        salary_range text NOT NULL DEFAULT '',
        summary text NOT NULL DEFAULT '',
        description text NOT NULL DEFAULT '',
        skills text[] NOT NULL DEFAULT '{}',
        status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','paused','closed')),
        closing_date date,
        published_at timestamptz,
        created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS job_openings_status ON job_openings(status)`,
      `CREATE TABLE IF NOT EXISTS candidates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        full_name text NOT NULL,
        phone text NOT NULL DEFAULT '',
        location text NOT NULL DEFAULT '',
        preferred_location text NOT NULL DEFAULT '',
        specialisation text NOT NULL DEFAULT '',
        experience text NOT NULL DEFAULT '',
        employment_type text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS applications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        number bigserial UNIQUE,
        candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
        opening_id uuid REFERENCES job_openings(id) ON DELETE SET NULL,
        source text NOT NULL CHECK (source IN ('careers','job','cv_upload')),
        position text NOT NULL DEFAULT '',
        experience text NOT NULL DEFAULT '',
        message text NOT NULL DEFAULT '',
        details jsonb NOT NULL DEFAULT '{}',
        status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','under_review','shortlisted','interview','offered','hired','rejected')),
        resume_path text,
        resume_name text,
        resume_size int,
        resume_type text,
        submitted_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS applications_submitted ON applications(submitted_at DESC)`,
      `CREATE INDEX IF NOT EXISTS applications_candidate ON applications(candidate_id)`,
      `CREATE INDEX IF NOT EXISTS applications_opening ON applications(opening_id)`,
      `CREATE TABLE IF NOT EXISTS application_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
        kind text NOT NULL CHECK (kind IN ('note','status')),
        body text NOT NULL DEFAULT '',
        from_status text,
        to_status text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS application_events_app ON application_events(application_id, created_at)`,
      `CREATE TABLE IF NOT EXISTS enquiries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        number bigserial UNIQUE,
        name text NOT NULL,
        company text NOT NULL DEFAULT '',
        email text NOT NULL,
        phone text NOT NULL DEFAULT '',
        service text NOT NULL DEFAULT '',
        requirement text NOT NULL DEFAULT '',
        message text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','converted','closed')),
        notes text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS activity_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
        action text NOT NULL,
        entity text NOT NULL,
        entity_id text,
        summary text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS activity_log_created ON activity_log(created_at DESC)`,
    ],
  },
  {
    // ATS phase 1: ten-stage pipeline, recruiter assignment, full candidate
    // profiles, a candidate-wide timeline and more job opening fields.
    version: 2,
    statements: [
      `ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check`,
      `UPDATE applications SET status = CASE status WHEN 'under_review' THEN 'screening' WHEN 'interview' THEN 'interview_scheduled' WHEN 'offered' THEN 'offer_released' ELSE status END`,
      `UPDATE application_events SET
         from_status = CASE from_status WHEN 'under_review' THEN 'screening' WHEN 'interview' THEN 'interview_scheduled' WHEN 'offered' THEN 'offer_released' ELSE from_status END,
         to_status = CASE to_status WHEN 'under_review' THEN 'screening' WHEN 'interview' THEN 'interview_scheduled' WHEN 'offered' THEN 'offer_released' ELSE to_status END
       WHERE kind = 'status'`,
      `ALTER TABLE applications ADD CONSTRAINT applications_status_check CHECK (status IN
         ('new','screening','shortlisted','interview_scheduled','interview_completed','selected','offer_released','hired','rejected','on_hold'))`,
      `ALTER TABLE applications
         ADD COLUMN assigned_to uuid REFERENCES admin_users(id) ON DELETE SET NULL,
         ADD COLUMN stage_changed_at timestamptz,
         ADD COLUMN hired_at timestamptz`,
      `UPDATE applications a SET stage_changed_at = COALESCE(
         (SELECT max(e.created_at) FROM application_events e WHERE e.application_id = a.id AND e.kind = 'status'), a.submitted_at)`,
      `UPDATE applications SET hired_at = stage_changed_at WHERE status = 'hired'`,
      `ALTER TABLE applications ALTER COLUMN stage_changed_at SET DEFAULT now(), ALTER COLUMN stage_changed_at SET NOT NULL`,
      `CREATE INDEX applications_status ON applications(status)`,
      `CREATE INDEX applications_assigned ON applications(assigned_to)`,

      `ALTER TABLE candidates
         ADD COLUMN tags text[] NOT NULL DEFAULT '{}',
         ADD COLUMN skills text[] NOT NULL DEFAULT '{}',
         ADD COLUMN qualifications text NOT NULL DEFAULT '',
         ADD COLUMN experience_years numeric(4,1) CHECK (experience_years >= 0 AND experience_years <= 60),
         ADD COLUMN current_title text NOT NULL DEFAULT '',
         ADD COLUMN current_company text NOT NULL DEFAULT '',
         ADD COLUMN notice_period text NOT NULL DEFAULT '',
         ADD COLUMN priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
         ADD COLUMN owner_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
         ADD COLUMN follow_up_on date,
         ADD COLUMN availability text NOT NULL DEFAULT '',
         ADD COLUMN last_contacted_at timestamptz,
         ADD COLUMN linkedin_url text NOT NULL DEFAULT '',
         ADD COLUMN summary text NOT NULL DEFAULT ''`,
      `CREATE INDEX candidates_tags ON candidates USING gin(tags)`,
      `CREATE INDEX candidates_skills ON candidates USING gin(skills)`,
      `CREATE INDEX candidates_follow_up ON candidates(follow_up_on) WHERE follow_up_on IS NOT NULL`,
      `CREATE INDEX candidates_owner ON candidates(owner_id)`,

      `ALTER TABLE application_events
         ADD COLUMN candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE,
         ADD COLUMN details jsonb NOT NULL DEFAULT '{}'`,
      `UPDATE application_events e SET candidate_id = a.candidate_id FROM applications a WHERE a.id = e.application_id`,
      `ALTER TABLE application_events ALTER COLUMN candidate_id SET NOT NULL, ALTER COLUMN application_id DROP NOT NULL`,
      `ALTER TABLE application_events DROP CONSTRAINT IF EXISTS application_events_kind_check`,
      `ALTER TABLE application_events ADD CONSTRAINT application_events_kind_check CHECK (kind IN ('note','status','assign','edit','email','interview','task','merge'))`,
      `CREATE INDEX application_events_candidate ON application_events(candidate_id, created_at)`,

      `ALTER TABLE job_openings
         ADD COLUMN vacancies int NOT NULL DEFAULT 1 CHECK (vacancies BETWEEN 1 AND 999),
         ADD COLUMN salary_visible boolean NOT NULL DEFAULT true,
         ADD COLUMN min_experience_years numeric(4,1) CHECK (min_experience_years >= 0 AND min_experience_years <= 60)`,
      `CREATE TABLE opening_recruiters (
         opening_id uuid NOT NULL REFERENCES job_openings(id) ON DELETE CASCADE,
         user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
         PRIMARY KEY (opening_id, user_id)
       )`,
    ],
  },
];
