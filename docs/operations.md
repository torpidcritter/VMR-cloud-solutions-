# Operations runbook

How to deploy, roll back, monitor, back up and restore the website and admin panel.
Written for whoever looks after the Vercel and Neon accounts.

## What runs where

| Part | Where | Holds |
| --- | --- | --- |
| Website and admin panel | Vercel (Next.js) | Code only |
| Database | Neon Postgres (`DATABASE_URL`) | Applications, candidates, openings, clients, users, audit log, email queue |
| Resumes | Vercel Blob, private (`BLOB_READ_WRITE_TOKEN`) | Uploaded CV files and their JSON records |
| Email | Your SMTP server (`SMTP_*`, `MAIL_FROM`) | Nothing is stored there by the site |
| Daily job | Vercel Cron → `/api/cron/reminders` (`CRON_SECRET`) | Reminders, email retries, audit clean-up |

## Deploying

1. Push to the branch. Vercel builds a preview deployment.
2. Check the preview: sign in to `/admin`, open an application, and call `/api/health` (see Monitoring).
3. Promote to production (merge to `main`, or "Promote" in Vercel).

Database changes run by themselves on the first request after a deploy. Each change after the first
runs in one transaction and is recorded in `schema_migrations`, so a failed change leaves the
database as it was. If two servers start at once, only one applies it.

All changes so far only add tables, columns, indexes and constraints. Older code keeps working on
the newer schema, which is what makes a rollback safe.

## Rolling back

1. Vercel → the project → Deployments → pick the last good production deployment → **Instant Rollback**.
2. Call `/api/health`. It should answer `200` with `"schema": "current"` (a newer schema counts as current).
3. Nothing needs to be done in the database. Do not delete rows from `schema_migrations`.

If a future change ever removes or renames a column, its pull request must say so, and the rollback
for that release needs a database restore (below) instead.

## Monitoring

`GET /api/health` answers:

- `200 {"status":"ok","database":"ok","schema":"current"}` when the site can take submissions.
- `503` with `"database":"down"` when Neon can't be reached, or `"schema":"behind"` when the
  database is older than the code.

With the header `Authorization: Bearer <CRON_SECRET>` it also reports storage, email, the number of
emails waiting to be retried (`outbox.pending`), emails that gave up (`outbox.gaveUp`) and the
response time. Never put the secret in a public monitor's URL.

**Set up (needs VMR):** point an uptime monitor (UptimeRobot, Better Stack or similar) at
`https://vmrcloudsolutions.com/api/health` every 5 minutes, alerting on anything other than 200.
The plain URL is enough for this; it reveals nothing.

**Logs:** server errors are written as one JSON object per line (`{"time","level","event",...}`)
and appear in Vercel → Logs. Useful events to search for:

| Event | Means |
| --- | --- |
| `careers.save_failed`, `cv.save_failed` | A submission couldn't be saved to the database (it was still emailed if email works) |
| `careers.storage_failed`, `cv.storage_failed` | A resume couldn't be written to Blob storage |
| `careers.notify_failed`, `cv.notify_failed` | The team email failed; if the submission was saved, it was queued (`outbox.queued`) |
| `careers.not_saved`, `cv.not_recorded` | Neither the database nor email took a submission (the applicant was told to try again, or the CV is only in storage) |
| `outbox.retry_failed`, `outbox.gave_up` | A queued email failed again, or failed its last attempt; see below |
| `health.database_down` | The health check couldn't reach the database |
| `cron.done` | The daily job ran, with counts of what it did |

## When email fails

If the email to the team fails after a submission was saved, the email goes into a queue
(`notification_outbox`) with the resume attached by reference. The daily job retries it, waiting
longer after each failure, up to 6 attempts. Two runs at once can't send it twice.

- The admin panel's Settings page shows an amber notice while emails are waiting or have given up.
- Every submission is in the admin panel whatever happens to its email, so nothing is lost.
- To retry sooner after fixing SMTP, call the daily job by hand:
  `curl -H "Authorization: Bearer $CRON_SECRET" https://vmrcloudsolutions.com/api/cron/reminders`

If the database is down but email works, the application is still emailed to the team with the
resume, and the applicant sees success. If both are down, the applicant is told to try again
later. The site never shows success for a submission it couldn't keep.

## Backups (needs VMR)

**Database.** Neon keeps a history of every change and can restore the database to any moment
inside the plan's restore window. Check the window for your plan in the Neon console
(Project → Settings / Backup & Restore). For recruitment data a window of at least 7 days is
recommended, which may need a paid plan.

For a copy outside Neon, take a weekly dump from any machine with Postgres tools:

```sh
pg_dump "$DATABASE_URL" --format=custom --no-owner --file vmr-$(date +%F).dump
```

Store it encrypted (it contains candidates' personal data) and delete dumps older than the
retention period you have committed to.

**Resumes.** Vercel Blob has no point-in-time restore. Files are only removed by the admin panel's
delete actions and the clean-up of uploads that never became an application. If an off-site copy
is required, it needs a separate scheduled copy; this is not built.

## Restoring the database

1. In the Neon console, open the project → **Backup & Restore** (or Branches) and restore to a
   **new branch** at the time just before the problem. Don't overwrite the main branch yet.
2. Copy that branch's connection string. Check the data with `psql`, for example
   `SELECT max(created_at) FROM applications;`.
3. Either restore the main branch from that point in Neon, or set `DATABASE_URL` in Vercel to the
   new branch's connection string and redeploy.
4. Call `/api/health`. If it says `"schema":"behind"`, the next request applies the missing
   changes; call it again.
5. Anything submitted after the restore point and before the restore is lost from the database,
   but every application from that period was also emailed to the team (subject
   "Job application: …"), so it can be entered again from those emails.

From a `pg_dump` file instead: create an empty Neon branch or database, then
`pg_restore --no-owner --dbname "$NEW_DATABASE_URL" vmr-YYYY-MM-DD.dump`, and continue from step 3.

Practise a restore to a new branch once before going live, and note how long it took.

## Automated checks

- `npm test`: unit and integration tests against an embedded Postgres (PGlite).
- `npm run build:e2e && npm run test:e2e`: browser, concurrency and load tests against a real
  production build. See `tests/e2e/README.md`.
- `.github/workflows/ci.yml` runs lint, type checks, both test suites and the build on every push
  and pull request.
