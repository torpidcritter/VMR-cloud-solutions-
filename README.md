# VMR Cloud Solutions – corporate website

Next.js 15 (App Router) + TypeScript + Tailwind CSS v4. Every page is statically generated; only the two form endpoints run on the server.

## Run locally

```bash
npm install
cp .env.example .env.local      # set MAIL_TRANSPORT=log to test forms without SMTP
npm run dev                      # http://localhost:3000
```

Production: `npm run build && npm start` (Node 18.18+), or deploy to Vercel / any Node host. Set the SMTP variables from `.env.example` in the host's environment settings, otherwise the forms show a friendly "temporarily unavailable" message with the email address instead of a false success.

## Where things live

| What | Where |
| --- | --- |
| Company details, contacts, social links | `src/content/site.ts` |
| Services (8 pages are generated from this) | `src/content/services.ts` |
| Values, timeline, industries, clients, certifications, careers | `src/content/company.ts` |
| Colours, typography, buttons, cards | `src/app/globals.css` |
| Header / footer | `src/components/layout/` |
| Forms + validation | `src/components/forms/`, `src/lib/forms.ts`, `src/app/api/*` |
| Logo, client logos, certification badges | `public/brand`, `public/clients`, `public/certifications` |

Social icons appear in the footer automatically once URLs are added to `site.social`.

## Pages

Home · About · Services (+8 service pages) · Technology Expertise · Industries · Careers (with resume upload) · Contact (enquiry form + map) · Privacy · Terms · Cookies · 404 · sitemap.xml · robots.txt

## Forms

- Client and server validation share one schema (`src/lib/forms.ts`).
- Spam protection: hidden honeypot field, minimum fill time, and 5 submissions / 10 min per IP.
- Resumes: PDF/DOC/DOCX up to 5 MB, file signature checked, sent to HR as an attachment.
- The success message only shows after the email has actually been sent.

## Before going live

See `CONTENT-CHECKLIST.md` for the items management needs to confirm.
