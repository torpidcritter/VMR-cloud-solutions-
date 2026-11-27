const { chromium } = require('playwright');
const fs = require('fs');
const { B, SHOTS, FIX, OUT, SERVER_LOG, ok } = require('./env');
const shot = async (p, name) => p.screenshot({ path: `${SHOTS}/admin/${name}.png`, fullPage: true });
const log = (...a) => console.log(...a);
async function login(b, email, password, xff, extra = {}) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { 'x-forwarded-for': xff }, ...extra });
  const p = await ctx.newPage();
  await p.goto(B + '/admin/login'); await p.fill('#email', email); await p.fill('#password', password); await p.click('button[type=submit]');
  await p.waitForURL(/\/admin(\?.*)?$|change-password/, { timeout: 8000 }).catch(() => {});
  return { ctx, p };
}
const toast = (p, text) => p.waitForSelector(`text=${text}`, { timeout: 10000 });

(async () => {
  const b = await chromium.launch();
  // Failed attempts first: wrong password, unknown account, a password typed into the email box
  const bad = await login(b, 'viewer@example.test', 'wrong-password-9', '203.0.113.61');
  log('wrong password stays on login:', bad.p.url().includes('/admin/login'));
  await login(b, 'ghost@example.test', 'whatever-123', '203.0.113.61');
  await login(b, 'hunter2-secret', 'whatever-123', '203.0.113.61');

  const { ctx, p } = await login(b, 'owner@example.test', 'test-pass-1234', '203.0.113.62');
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(`${p.url()}: ${m.text()}`));

  // ---- Sign-ins tab
  await p.goto(B + '/admin/activity?tab=signins');
  const s = await p.textContent('main');
  log('failed 24h card:', (await p.locator('text=Failed sign-ins, last 24 hours').locator('xpath=..').textContent()).replace(/\s+/g, ' ').trim());
  log('sign-ins page shows: wrong password', s.includes('Wrong password'), '| no such account', s.includes('No such account'), '| masked typed password', s.includes('(not an email address)'), '| leaked typed password', s.includes('hunter2'));
  await p.selectOption('#outcome', 'failed'); await p.click('button:has-text("Apply filters")'); await p.waitForURL(/outcome=failed/);
  log('failed filter rows:', await p.locator('tbody tr').count(), '| any success shown:', await p.locator('tbody >> text=Signed in').count());
  await shot(p, '81-signins');

  // ---- Client and candidate views are logged; audit trail link
  await p.goto(B + '/admin/clients'); await p.click('tbody tr a >> nth=0'); await p.waitForURL(/clients\/[0-9a-f-]{36}/);
  const clientName = (await p.textContent('h1')).trim();
  await p.reload(); // a second look within 30 minutes is not logged again
  await p.click('a:has-text("Audit trail")'); await p.waitForURL(/activity\?entity=client&id=/);
  const trail = await p.locator('tbody tr').allTextContents();
  log('client trail rows:', trail.length, '| view entries:', trail.filter((t) => t.includes('Viewed client')).length, '| one-record notice:', await p.locator('text=Showing the history of one record').count());
  await p.goto(B + '/admin/candidates'); await p.click('tbody tr a >> nth=0'); await p.waitForURL(/candidates\/[0-9a-f-]{36}/);
  await p.goto(B + '/admin/activity?action=view'); log('view entries:', await p.locator('tbody tr').count(), '|', (await p.locator('tbody tr >> nth=0').textContent()).replace(/\s+/g, ' ').slice(0, 80));

  // ---- Filters on the activity log
  await p.goto(B + '/admin/activity');
  await p.selectOption('#entity', 'client'); await p.fill('#q', clientName.slice(0, 6)); await p.click('button:has-text("Apply filters")'); await p.waitForURL(/entity=client/);
  log('client filter rows:', await p.locator('tbody tr').count());
  const r = await p.request.get(B + '/admin/activity?from=2026-02-31&to=2026-99-99&user=junk&action=%27%3B--'); log('junk filters:', r.status());
  await p.goto(B + '/admin/activity'); await shot(p, '82-activity');
  const csv = await p.request.get(B + '/admin/api/activity-export?action=view'); const csvText = await csv.text();
  log('activity csv:', csv.status(), csv.headers()['content-disposition'], '| rows:', csvText.split('\r\n').length - 1);
  const csv2 = await p.request.get(B + '/admin/api/activity-export?tab=signins&outcome=failed'); log('sign-ins csv:', csv2.status(), '| rows:', (await csv2.text()).split('\r\n').length - 1);

  // ---- User page: recent sign-ins
  await p.goto(B + '/admin/users'); await p.click('a:has-text("View Only")'); await p.waitForURL(/users\/[0-9a-f-]{36}/);
  log('user page sign-ins:', (await p.locator('text=Recent sign-ins').locator('xpath=ancestor::section[1]').textContent().catch(async () => await p.textContent('main'))).includes('Wrong password'));
  await shot(p, '83-user-signins');

  // ---- Retention setting
  await p.goto(B + '/admin/settings'); await p.selectOption('#auditRetentionDays', '365'); await p.click('button:has-text("Save settings")'); await toast(p, 'Settings saved.');
  await p.goto(B + '/admin/activity'); log('header retention:', (await p.textContent('header, main')).includes('kept for 365 days'));
  log('settings change logged:', await p.locator('text=/auditRetentionDays 730 → 365/').count());
  const cron = await p.request.get(B + '/api/cron/reminders', { headers: { authorization: 'Bearer test-cron-secret-1234567' } }); log('cron prune:', JSON.stringify((await cron.json()).pruned));

  // ---- Sign out is recorded
  await p.click('header details summary'); await p.click('button:has-text("Sign out")'); await p.waitForURL(/\/admin\/login/);

  // ---- Viewer: no audit access
  const { p: v } = await login(b, 'viewer@example.test', 'blue-river-4821', '203.0.113.63');
  await v.goto(B + '/admin/activity'); log('viewer activity ->', v.url().replace(B, ''));
  log('viewer audit csv:', (await v.request.get(B + '/admin/api/activity-export')).status());
  await v.goto(B + '/admin/candidates'); await v.click('tbody tr a >> nth=0'); await v.waitForURL(/candidates\/[0-9a-f-]{36}/);
  log('viewer sees audit trail button:', await v.locator('a:has-text("Audit trail")').count());

  // ---- Final QA crawl: every admin page as owner, desktop and phone, light and dark
  const { ctx: c2, p: q } = await login(b, 'owner@example.test', 'test-pass-1234', '203.0.113.64');
  const qErr = []; q.on('pageerror', e => qErr.push(`${q.url()}: ${e.message}`)); q.on('console', m => m.type() === 'error' && qErr.push(`${q.url()}: ${m.text()}`));
  await q.goto(B + '/admin/activity?tab=signins&outcome=signout'); log('sign-out recorded:', await q.locator('tbody >> text=Signed out').count());
  const ids = {};
  for (const [k, list] of [['application', '/admin/applications'], ['candidate', '/admin/candidates'], ['client', '/admin/clients'], ['enquiry', '/admin/enquiries'], ['interview', '/admin/interviews'], ['opening', '/admin/openings'], ['pool', '/admin/talent-pools'], ['user', '/admin/users']]) {
    await q.goto(B + list);
    const href = await q.locator(`main a[href^="${list}/"]`).evaluateAll((as) => as.map((a) => a.getAttribute('href')).find((h) => /\/[0-9a-f-]{36}$/.test(h)));
    ids[k] = href;
  }
  const pages = ['/admin', '/admin/my-work', '/admin/analytics', '/admin/pipeline', '/admin/applications', '/admin/interviews', '/admin/tasks', '/admin/candidates', '/admin/candidates/new', '/admin/talent', '/admin/talent-pools', '/admin/clients', '/admin/clients/new', '/admin/openings', '/admin/openings/new', '/admin/enquiries', '/admin/users', '/admin/activity', '/admin/activity?tab=signins', '/admin/settings', '/admin/settings/email-templates', '/admin/notifications', ...Object.values(ids).filter(Boolean)];
  if (ids.opening) pages.push(ids.opening + '/matches');
  const results = [];
  for (const scheme of ['light', 'dark']) {
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      const pg = await (await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, storageState: await c2.storageState(), extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.64' } })).newPage();
      pg.on('pageerror', e => qErr.push(`${pg.url()}: ${e.message}`)); pg.on('console', m => m.type() === 'error' && qErr.push(`${pg.url()}: ${m.text()}`));
      for (const u of pages) {
        const res = await pg.goto(B + u);
        const over = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        const h1 = await pg.locator('h1').count();
        if (res.status() !== 200 || over > 0 || !h1 || pg.url().includes('denied')) results.push(`${scheme} ${w}px ${u}: status ${res.status()} overflow ${over} h1 ${h1} url ${pg.url().replace(B, '')}`);
      }
      await pg.context().close();
    }
  }
  log('QA crawl pages:', pages.length, 'x 4 views | problems:', results.length ? results : 'none');
  // Public site still fine
  for (const u of ['/', '/careers', '/upload-cv', '/contact', '/sitemap.xml', '/robots.txt']) { const res = await q.request.get(B + u); log('public', u, res.status()); }
  const robots = await (await q.request.get(B + '/robots.txt')).text(); log('robots blocks /admin:', /Disallow: \/admin/.test(robots));
  const hdr = (await q.request.get(B + '/admin/activity')).headers(); log('admin headers:', hdr['x-robots-tag'], '|', hdr['cache-control']);

  // Mobile + dark shots of the audit pages
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, storageState: await c2.storageState(), extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.64' } })).newPage();
  await m.goto(B + '/admin/activity?tab=signins'); await shot(m, '84-signins-mobile');
  const d = await (await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', storageState: await c2.storageState(), extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.64' } })).newPage();
  await d.goto(B + '/admin/activity'); await shot(d, '85-activity-dark');
  log('errors:', [...errs, ...qErr].join(' | ') || 'none');
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
