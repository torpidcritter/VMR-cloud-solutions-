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
  {
    // ATS phase 2: interviews with panels and feedback, recruiter targets.
    version: 3,
    statements: [
      `CREATE TABLE interviews (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
         round text NOT NULL DEFAULT '',
         scheduled_at timestamptz NOT NULL,
         duration_minutes int NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 10 AND 480),
         mode text NOT NULL DEFAULT 'video' CHECK (mode IN ('video','phone','in_person')),
         location text NOT NULL DEFAULT '',
         status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')),
         notes text NOT NULL DEFAULT '',
         cancel_reason text NOT NULL DEFAULT '',
         reminded_at timestamptz,
         created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
         created_at timestamptz NOT NULL DEFAULT now(),
         updated_at timestamptz NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX interviews_time ON interviews(scheduled_at)`,
      `CREATE INDEX interviews_application ON interviews(application_id)`,
      `CREATE TABLE interview_panel (
         interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
         user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
         PRIMARY KEY (interview_id, user_id)
       )`,
      `CREATE INDEX interview_panel_user ON interview_panel(user_id)`,
      `CREATE TABLE interview_feedback (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
         user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
         rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
         recommendation text NOT NULL CHECK (recommendation IN ('strong_yes','yes','maybe','no')),
         notes text NOT NULL DEFAULT '',
         created_at timestamptz NOT NULL DEFAULT now(),
         updated_at timestamptz NOT NULL DEFAULT now(),
         UNIQUE (interview_id, user_id)
       )`,
      `CREATE TABLE recruiter_targets (
         user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
         month date NOT NULL,
         placements int NOT NULL CHECK (placements BETWEEN 0 AND 999),
         PRIMARY KEY (user_id, month)
       )`,
    ],
  },
  {
    // ATS phase 3: resumes uploaded by admins (with extracted text), searchable
    // text for website resumes, and talent pools.
    version: 4,
    statements: [
      `CREATE TABLE candidate_files (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
         file_path text NOT NULL UNIQUE,
         file_name text NOT NULL,
         file_size int NOT NULL CHECK (file_size > 0),
         file_type text NOT NULL CHECK (file_type IN ('pdf','doc','docx')),
         text_content text NOT NULL DEFAULT '',
         text_status text NOT NULL DEFAULT 'empty' CHECK (text_status IN ('ok','empty','failed')),
         uploaded_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
         created_at timestamptz NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX candidate_files_candidate ON candidate_files(candidate_id)`,
      `ALTER TABLE applications
         ADD COLUMN resume_text text NOT NULL DEFAULT '',
         ADD COLUMN resume_text_status text CHECK (resume_text_status IN ('ok','empty','failed'))`,
      `CREATE TABLE talent_pools (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
         description text NOT NULL DEFAULT '',
         created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
         created_at timestamptz NOT NULL DEFAULT now(),
         updated_at timestamptz NOT NULL DEFAULT now()
       )`,
      `CREATE UNIQUE INDEX talent_pools_name ON talent_pools(lower(name))`,
      `CREATE TABLE talent_pool_members (
         pool_id uuid NOT NULL REFERENCES talent_pools(id) ON DELETE CASCADE,
         candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
         added_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
         added_at timestamptz NOT NULL DEFAULT now(),
         PRIMARY KEY (pool_id, candidate_id)
       )`,
      `CREATE INDEX talent_pool_members_candidate ON talent_pool_members(candidate_id)`,
      // Recruiters can put a Talent Bank candidate forward for an opening.
      `ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_source_check`,
      `ALTER TABLE applications ADD CONSTRAINT applications_source_check CHECK (source IN ('careers','job','cv_upload','talent'))`,
      `ALTER TABLE application_events DROP CONSTRAINT application_events_kind_check`,
      `ALTER TABLE application_events ADD CONSTRAINT application_events_kind_check CHECK (kind IN ('note','status','assign','edit','email','interview','task','merge','file','pool'))`,
    ],
  },
  {
    // ATS phase 4: client CRM (linked to openings), email templates and the
    // emails sent to candidates, and in-app notifications.
    version: 5,
    statements: [
      `CREATE TABLE clients (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         name text NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
         industry text NOT NULL DEFAULT '',
         website text NOT NULL DEFAULT '',
         location text NOT NULL DEFAULT '',
         status text NOT NULL DEFAULT 'active' CHECK (status IN ('prospect','active','inactive')),
         account_manager_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
         notes text NOT NULL DEFAULT '',
         enquiry_id uuid REFERENCES enquiries(id) ON DELETE SET NULL,
         created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
         created_at timestamptz NOT NULL DEFAULT now(),
         updated_at timestamptz NOT NULL DEFAULT now()
       )`,
      `CREATE UNIQUE INDEX clients_name ON clients(lower(name))`,
      `CREATE TABLE client_contacts (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
         name text NOT NULL,
         title text NOT NULL DEFAULT '',
         email text NOT NULL DEFAULT '',
         phone text NOT NULL DEFAULT '',
         is_primary boolean NOT NULL DEFAULT false,
         created_at timestamptz NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX client_contacts_client ON client_contacts(client_id)`,
      `CREATE TABLE client_requirements (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
         title text NOT NULL,
         sap_module text NOT NULL DEFAULT '',
         positions int NOT NULL DEFAULT 1 CHECK (positions BETWEEN 1 AND 999),
         status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','on_hold','filled','cancelled')),
         needed_by date,
         notes text NOT NULL DEFAULT '',
         opening_id uuid REFERENCES job_openings(id) ON DELETE SET NULL,
         created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
         created_at timestamptz NOT NULL DEFAULT now(),
         updated_at timestamptz NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX client_requirements_client ON client_requirements(client_id)`,
      `CREATE TABLE client_events (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
         user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
         kind text NOT NULL CHECK (kind IN ('note','edit','contact','requirement','opening')),
         body text NOT NULL,
         created_at timestamptz NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX client_events_client ON client_events(client_id, created_at DESC)`,
      `ALTER TABLE job_openings ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL`,
      `CREATE INDEX job_openings_client ON job_openings(client_id)`,
      // Every client named on an opening today becomes a client record.
      `INSERT INTO clients (name, created_at)
       SELECT DISTINCT ON (lower(trim(client_name))) left(trim(client_name), 160), created_at FROM job_openings
        WHERE trim(client_name) <> '' ORDER BY lower(trim(client_name)), created_at`,
      `UPDATE job_openings o SET client_id = c.id FROM clients c WHERE lower(trim(o.client_name)) = lower(c.name)`,
      `CREATE TABLE email_templates (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
         subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
         body text NOT NULL CHECK (length(body) BETWEEN 1 AND 8000),
         active boolean NOT NULL DEFAULT true,
         updated_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
         created_at timestamptz NOT NULL DEFAULT now(),
         updated_at timestamptz NOT NULL DEFAULT now()
       )`,
      `CREATE UNIQUE INDEX email_templates_name ON email_templates(lower(name))`,
      `INSERT INTO email_templates (name, subject, body) VALUES
        ('Application received', 'Your application for {{position}}',
         E'Dear {{candidate_first_name}},\n\nThank you for applying for the {{position}} role with VMR Cloud Solutions. Our team is reviewing your profile and will be in touch if it is a good fit.\n\nRegards,\n{{recruiter_name}}\nVMR Cloud Solutions'),
        ('Shortlisted', 'Next steps for {{position}}',
         E'Dear {{candidate_first_name}},\n\nGood news: your profile has been shortlisted for the {{position}} role. I would like to set up a short call to discuss the next steps. Please reply with a few times that suit you.\n\nRegards,\n{{recruiter_name}}\nVMR Cloud Solutions'),
        ('Interview invitation', 'Interview for {{position}} on {{interview_date}}',
         E'Dear {{candidate_first_name}},\n\nYour {{interview_round}} for the {{position}} role is scheduled for {{interview_date}} at {{interview_time}} (India time).\n\nHow: {{interview_mode}}\nWhere: {{interview_location}}\n\nPlease reply to confirm, or let me know if you need a different time.\n\nRegards,\n{{recruiter_name}}\nVMR Cloud Solutions'),
        ('Not taken forward', 'Your application for {{position}}',
         E'Dear {{candidate_first_name}},\n\nThank you for your interest in the {{position}} role. After careful review we will not be taking your application forward this time. We will keep your profile on file and contact you about suitable roles in future.\n\nRegards,\n{{recruiter_name}}\nVMR Cloud Solutions'),
        ('Offer', 'Offer for {{position}}',
         E'Dear {{candidate_first_name}},\n\nI am pleased to let you know that we would like to make you an offer for the {{position}} role. I will call you shortly to go through the details.\n\nRegards,\n{{recruiter_name}}\nVMR Cloud Solutions')`,
      `CREATE TABLE email_messages (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
         application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
         template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
         to_email text NOT NULL,
         subject text NOT NULL,
         body text NOT NULL,
         status text NOT NULL CHECK (status IN ('sent','failed')),
         error text NOT NULL DEFAULT '',
         sent_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
         created_at timestamptz NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX email_messages_candidate ON email_messages(candidate_id, created_at DESC)`,
      `CREATE TABLE notifications (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
         kind text NOT NULL,
         title text NOT NULL,
         link text NOT NULL DEFAULT '',
         read_at timestamptz,
         created_at timestamptz NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX notifications_user ON notifications(user_id, created_at DESC)`,
    ],
  },
  {
    // ATS phase 5: tasks, and the daily reminder bookkeeping for tasks and follow-ups.
    version: 6,
    statements: [
      `CREATE TABLE tasks (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
         notes text NOT NULL DEFAULT '',
         owner_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
         created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
         due_on date,
         priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
         status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
         candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE,
         application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
         opening_id uuid REFERENCES job_openings(id) ON DELETE SET NULL,
         client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
         completed_at timestamptz,
         completed_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
         reminded_on date,
         created_at timestamptz NOT NULL DEFAULT now(),
         updated_at timestamptz NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX tasks_owner_open ON tasks(owner_id, due_on) WHERE status = 'open'`,
      `CREATE INDEX tasks_candidate ON tasks(candidate_id) WHERE candidate_id IS NOT NULL`,
      `CREATE INDEX tasks_client ON tasks(client_id) WHERE client_id IS NOT NULL`,
      `CREATE INDEX tasks_opening ON tasks(opening_id) WHERE opening_id IS NOT NULL`,
      `ALTER TABLE candidates ADD COLUMN follow_up_reminded_on date`,
      `ALTER TABLE client_events DROP CONSTRAINT client_events_kind_check`,
      `ALTER TABLE client_events ADD CONSTRAINT client_events_kind_check CHECK (kind IN ('note','edit','contact','requirement','opening','task'))`,
    ],
  },
];
