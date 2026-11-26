// Concurrency and load checks against a running server (see README.md).
// - 30 copies of one submission sent at once save exactly one application.
// - 30 different submissions sent at once are all saved.
// - Page and health-check response times under 20 parallel requests.
const { chromium, request } = require('playwright');
const fs = require('fs');
const crypto = require('crypto');
const { B, FIX, ok } = require('./env');

const pdf = fs.readFileSync(FIX + '/test-cv.pdf');
const run = crypto.randomBytes(3).toString('hex');
const form = (email, extra = {}) => ({
  fullName: 'Load Tester', email, phone: '+91 90000 12121', position: 'Other', experience: '3–5 years', message: '',
  startedAt: String(Date.now() - 60_000), website: '', consent: 'yes', resume: { name: 'cv.pdf', mimeType: 'application/pdf', buffer: pdf }, ...extra,
});
const pct = (a, p) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];

(async () => {
  const api = await request.newContext({ baseURL: B });
  const post = (i, data) => api.post('/api/careers', { multipart: data, headers: { 'x-forwarded-for': `10.77.${Math.floor(i / 250)}.${i % 250}` } });

  // Same submission 30 times at once (a retrying client or proxy).
  const sameKey = crypto.randomUUID();
  const same = await Promise.all(Array.from({ length: 30 }, (_, i) => post(i, form(`same.${run}@example.test`, { submissionId: sameKey }))));
  ok('all 30 copies answered 200', same.map((r) => r.status()).filter((s) => s !== 200).length, 0);

  // 30 different people at once.
  const many = await Promise.all(Array.from({ length: 30 }, (_, i) => post(100 + i, form(`many.${run}.${i}@example.test`, { submissionId: crypto.randomUUID() }))));
  ok('30 different submissions answered 200', many.map((r) => r.status()).filter((s) => s !== 200).length, 0);

  // Count what was saved, through the admin panel's CSV export (owner account).
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': '10.78.0.1' } });
  const page = await ctx.newPage();
  await page.goto(B + '/admin/login'); await page.fill('#email', 'owner@example.test'); await page.fill('#password', 'test-pass-1234'); await page.click('button[type=submit]');
  await page.waitForURL(/\/admin$/, { timeout: 10000 });
  const admin = ctx.request;
  const csv = async (q) => (await (await admin.get(B + '/admin/api/applications-export?q=' + encodeURIComponent(q))).text()).trim().split('\n').length - 1;
  ok('one application for 30 copies of one submission', await csv(`same.${run}@example.test`), 1);
  ok('30 applications for 30 people', await csv(`many.${run}.`), 30);

  // Response times with 20 requests in flight.
  const timed = async (path, n = 200, par = 20) => {
    const times = []; let next = 0; const errors = [];
    await Promise.all(Array.from({ length: par }, async () => {
      while (next < n) { next++; const t = Date.now(); const r = await api.get(path); times.push(Date.now() - t); if (r.status() !== 200) errors.push(r.status()); }
    }));
    return { p50: pct(times, 0.5), p95: pct(times, 0.95), max: Math.max(...times), errors: errors.length };
  };
  const careers = await timed('/careers');
  const health = await timed('/api/health');
  console.log('timings (ms)', JSON.stringify({ careers, health }));
  ok('careers page: no errors under load', careers.errors, 0);
  ok('health check: no errors under load', health.errors, 0);
  ok('careers page p95 under 2 s', careers.p95, (v) => v < 2000);
  ok('health check p95 under 1 s', health.p95, (v) => v < 1000);
  await api.dispose(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
