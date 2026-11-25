/**
 * Database schema, applied in order on first use (see client.ts).
 * Never edit a released migration: add a new one with the next version.
 * Every statement is idempotent so concurrent cold starts are safe.
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
];
