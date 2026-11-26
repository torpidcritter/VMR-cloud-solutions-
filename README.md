# VMR Cloud Solutions – corporate website

Next.js 15 (App Router) + TypeScript + Tailwind CSS v4. Every page is statically generated; only the three form endpoints (`/api/contact`, `/api/careers`, `/api/cv`) run on the server.

The site positions VMR Cloud as a specialist **SAP recruitment & staffing** partner (contract, permanent and project staffing for end customers and SAP service integrators), alongside its technology services.

## Run locally

```bash
npm install
cp .env.example .env.local      # set MAIL_TRANSPORT=log to test forms without SMTP
npm run dev                      # http://localhost:3000
npm test                         # unit + API tests (Vitest)
npm run typecheck && npm run lint
```

For local CV uploads without Vercel Blob, add `CV_STORAGE=local` to `.env.local` (files go to `./.data`, which is git-ignored and never served).

Production: `npm run build && npm start` (Node 18.18+), or deploy to Vercel / any Node host. Set the SMTP variables from `.env.example` in the host's environment settings, otherwise the forms show a friendly "temporarily unavailable" message with the email address instead of a false success.

## Where things live

| What | Where |
| --- | --- |
| Company details, contacts, social links | `src/content/site.ts` |
| SAP recruitment services, SAP areas, employer / candidate paths | `src/content/recruitment.ts` |
| Client logos (Our Clients page + homepage strip) | `src/content/clients.ts` |
| Technology services (8 pages are generated from this) | `src/content/services.ts` |
| Values, timeline, industries, certifications, careers | `src/content/company.ts` |
| Colours, typography, buttons, cards | `src/app/globals.css` |
| Header / footer | `src/components/layout/` |
| Forms + validation | `src/components/forms/`, `src/lib/forms.ts`, `src/app/api/*` |
| Logo, client logos, certification badges | `public/brand`, `public/clients`, `public/certifications` |

Social icons appear in the footer automatically once URLs are added to `site.social`.

## Pages

Main navigation: Home · About Us · Services · SAP Expertise · Our Clients · Contact Us, plus the **Upload Your CV** button.

All pages: Home · About · Services (SAP recruitment + 8 technology service pages) · SAP Expertise · Our Clients · Upload Your CV · Technology Expertise · Industries · Careers · Contact · Privacy · Terms · Cookies · 404 · sitemap.xml · robots.txt

## Adding a client

1. Put the logo in `public/clients/` (SVG, or WebP/PNG about 160 px tall on white or transparent).
2. Add `{ name, logo, w, h }` to `src/content/clients.ts` (optional: `sector`, `website`). The page, grid and count update automatically.

## Upload Your CV (`/upload-cv` → `POST /api/cv`)

1. Browser and server share one schema (`src/lib/cv.ts`): every field, PDF/DOC/DOCX only, max 4 MB, data-processing consent required.
2. The server rejects requests from other sites (Origin check), bots (honeypot + timing) and floods (5 per 10 min per IP).
3. The file's bytes are checked (`src/lib/file-check.ts`): it must really be a PDF/DOC/DOCX matching its extension, with no macros, scripts, ActiveX or embedded files.
4. The CV and a JSON record (details + consent time and version) are saved to **private** storage under a random ID (`src/lib/cv-storage.ts`); no personal data appears in file paths.
5. The recruitment team gets an email with the details and the CV attached.

If storage or email isn't configured, the form says uploads are temporarily unavailable. It never shows a fake success.

### Production setup on Vercel

- **Storage:** Vercel dashboard → Storage → Create → **Blob**, access **Private**, connect it to this project. Vercel adds `BLOB_READ_WRITE_TOKEN`. Redeploy. Stored CVs can be browsed and downloaded in the Blob store's file browser.
- **Email:** set the `SMTP_*` variables and `MAIL_FROM` (see `.env.example`). Optional `CV_TO` (defaults to `CAREERS_TO`, then hr@).

Limits: 4 MB per CV (Vercel's request limit is 4.5 MB). The rate limit is per server instance. Content checks are structural and not an antivirus scan.

## Forms

- Client and server validation share one schema (`src/lib/forms.ts`).
- Spam protection: hidden honeypot field, minimum fill time, and 5 submissions / 10 min per IP.
- Careers resumes: PDF/DOC/DOCX up to 4 MB, file signature checked, sent to HR as an attachment.
- With the database connected, every application, CV and enquiry is also saved for the admin panel. The visitor sees success only once the submission is saved or emailed.

## Admin panel (`/admin`)

Recruitment admin for job openings, applications, the talent bank and enquiries.

**Switching it on (one time):**

1. Vercel → Storage → Create → **Neon** (Postgres) and connect it to this project. Vercel adds `DATABASE_URL`. Tables are created automatically on first use.
2. Add `ADMIN_SETUP_KEY` (any long secret phrase) under Settings → Environment Variables. Redeploy.
3. Open `/admin/setup`, enter the key and create the first **Super Admin**. The page stops working once an admin exists.
4. Add colleagues under **Users**. They get a temporary password and must choose their own at first sign-in.

**What's inside:**

- **Recruitment:** dashboard and My work; Kanban pipeline with ten stages; applications with filters, notes, recruiter assignment and bulk actions (stage, assign, tag, follow-up, resume ZIP, CSV of a selection); interviews with panels, feedback, calendar files and email reminders; tasks with due dates and daily in-app reminders.
- **People:** one candidate profile per email with a full timeline and field-level change history, duplicate merge, uploaded resumes that are read for search, Talent Bank and talent pools, rule-based matching to openings that shows its reasons, and email from templates.
- **Business:** job openings that appear on `/careers` (client names never reach the public site); clients with contacts, requirements and history; enquiries that can become clients.
- **Analytics:** conversion by stage, time to hire, first response, results by source, opening, recruiter and client, skill demand, all with date ranges and CSV export.
- **Admin:** users and roles, settings, email templates, in-app notifications, and an audit log of changes, record views and every sign-in attempt, with filters, CSV export and a retention period.

**Daily job:** `vercel.json` calls `/api/cron/reminders` once a day. Set `CRON_SECRET` (16+ characters) in Vercel so it can run. It sends interview reminders (needs SMTP), posts task and follow-up reminders, and deletes audit entries older than the retention period set in Settings.

**Security:** scrypt-hashed passwords, httpOnly session cookie (8 hours, and 60 minutes without activity), optional two-step sign-in with an authenticator app and recovery codes (Settings can require it for Super Admins), lockout after 5 wrong passwords, a per-IP limit on sign-in and the public forms shared by every server instance (kept in the database, IPs stored hashed), a Content-Security-Policy on every page, contact details masked for Viewer and Sales, roles checked on the server for every page, action and download. Client names on openings are never sent to the public site. Resumes stay in private storage and are streamed only to signed-in admins with the right role. Downloads of a selection only accept requests from the admin pages themselves. `/admin` is excluded from search engines.

| Role | Can do |
| --- | --- |
| Super Admin | Everything, including users, settings, the audit log and deleting records |
| Recruiter / HR | Openings (incl. client names), candidates, pipeline, interviews, clients, emails to candidates, bulk actions, analytics, resumes and CSV export |
| Sales (SAP Practice) | Clients and enquiries; view openings and applications; tasks; analytics without client-opening links; download resumes |
| Viewer | Read-only dashboard, openings, applications, enquiries; their own tasks |

**Local development:** `DB_DRIVER=pglite PGLITE_DIR=./.data/pglite ADMIN_SETUP_KEY=dev npm run dev` runs an embedded Postgres, no server needed.

## Before going live

See `CONTENT-CHECKLIST.md` for the items management needs to confirm.
