# VMR Cloud Solutions – corporate website

Next.js 15 (App Router) + TypeScript + Tailwind CSS v4. Every page is statically generated; only the three form endpoints (`/api/contact`, `/api/careers`, `/api/cv`) run on the server.

The site positions VMR Cloud as a specialist **SAP recruitment & staffing** partner for the UK and Europe (contract, permanent and project staffing), alongside its technology services.

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

1. Browser and server share one schema (`src/lib/cv.ts`): every field, PDF/DOC/DOCX only, max 4 MB, UK GDPR consent required.
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
- The success message only shows after the email has actually been sent.

## Before going live

See `CONTENT-CHECKLIST.md` for the items management needs to confirm.
