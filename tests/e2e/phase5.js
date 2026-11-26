const { chromium } = require('playwright');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { B, SHOTS, FIX, OUT, SERVER_LOG, ok } = require('./env');
const shot = async (p, name) => p.screenshot({ path: `${SHOTS}/admin/${name}.png`, fullPage: true });
const log = (...a) => console.log(...a);
async function login(b, email, password, xff, extra = {}) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { 'x-forwarded-for': xff }, acceptDownloads: true, ...extra });
  const p = await ctx.newPage();
  await p.goto(B + '/admin/login'); await p.fill('#email', email); await p.fill('#password', password); await p.click('button[type=submit]');
  await p.waitForURL(/\/admin(\?.*)?$|change-password/);
  return { ctx, p };
}
const toast = (p, text) => p.waitForSelector(`text=${text}`, { timeout: 10000 });
const iso = (d) => new Date(Date.now() + 5.5 * 3600_000 + d * 86_400_000).toISOString().slice(0, 10);

(async () => {
  const b = await chromium.launch();
  const { ctx, p } = await login(b, 'owner@example.test', 'test-pass-1234', '203.0.113.51');
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const nav = await p.textContent('aside nav'); log('nav has Tasks:', nav.includes('Tasks'), '| Analytics:', nav.includes('Analytics'));

  // ---- Tasks
  await p.goto(B + '/admin/tasks');
  await p.click('button:has-text("Add task")'); await p.waitForSelector('#tk-title[aria-invalid=true]'); log('empty task refused');
  await p.fill('#tk-title', 'Send the shortlist to the client'); await p.fill('#tk-due', iso(0)); await p.selectOption('#tk-priority', 'high');
  await p.click('button:has-text("Add task")'); await toast(p, 'Task added.'); await p.waitForTimeout(500);
  await p.fill('#tk-title', 'Chase overdue feedback'); await p.fill('#tk-due', iso(-2)); await p.click('button:has-text("Add task")'); await toast(p, 'Task added.'); await p.waitForTimeout(500);
  await p.fill('#tk-title', 'Review the viewer access'); await p.selectOption('#tk-owner', { label: 'View Only' }); await p.click('button:has-text("Add task")'); await toast(p, 'Task added.'); await p.waitForTimeout(500);
  await p.goto(B + '/admin/tasks');
  const stats = await p.locator('main .grid >> nth=0').innerText();
  log('task stats:', stats.replace(/\s+/g, ' '));
  log('my open tasks:', await p.locator('button[aria-label^="Mark done:"]').count());
  await p.click('a:has-text("Overdue") >> nth=-1'); await p.waitForURL(/due=overdue/); log('overdue list:', await p.locator('button[aria-label^="Mark done:"]').count());
  await p.goto(B + '/admin/tasks?who=all'); log('everyone list:', await p.locator('button[aria-label^="Mark done:"]').count());
  await shot(p, '73-tasks');
  await p.goto(B + '/admin/tasks');
  await p.click('button[aria-label="Mark done: Chase overdue feedback"]'); await p.waitForTimeout(800);
  await p.goto(B + '/admin/tasks?status=done'); log('done tab:', await p.locator('button[aria-label^="Reopen:"]').count());

  // Task on a candidate profile, linked to an application
  await p.goto(B + '/admin/candidates?q=candidate%40example.test'); await p.click('tbody tr a >> nth=0'); await p.waitForURL(/candidates\/[0-9a-f-]{36}/); const prof = p.url().split('?')[0];
  await p.click('summary:has-text("Add a task")'); await p.fill('#ctk-title', 'Confirm notice period'); await p.fill('#ctk-due', iso(1)); await p.selectOption('#ctk-app', { index: 1 });
  await p.click('button:has-text("Add task")'); await toast(p, 'Task added.'); await p.waitForTimeout(600);
  await p.goto(prof); log('profile tasks panel:', await p.locator('text=Tasks (1 open)').count(), '| timeline task event:', await p.locator('text=Task added: Confirm notice period').count());
  await p.goto(B + '/admin/my-work'); log('my work shows tasks:', await p.locator('text=Confirm notice period').count());

  // ---- Analytics
  await p.goto(B + '/admin/analytics'); const an = await p.textContent('main');
  log('analytics sections:', ['Applications', 'Time to hire', 'By source', 'By recruiter', 'By job opening', 'By client', 'Skill demand'].map((s) => `${s}:${an.includes(s)}`).join(' '));
  await shot(p, '74-analytics');
  await p.click('a.a-chip:has-text("All time")'); await p.waitForURL(/range=all/); log('all-time chip active:', await p.getAttribute('a.a-chip:has-text("All time")', 'aria-current'));
  await p.fill('#from', '2026-02-31').catch(() => {});
  const bad = await p.request.get(B + '/admin/analytics?from=2026-02-31&to=2026-13-40'); log('analytics with impossible dates:', bad.status());
  const badApps = await p.request.get(B + '/admin/applications?from=2026-02-31'); log('applications with impossible date:', badApps.status());
  for (const sec of ['funnel', 'sources', 'recruiters', 'openings', 'clients', 'skills']) {
    const r = await p.request.get(B + `/admin/api/analytics-export?section=${sec}&range=all`);
    const t = await r.text(); log(`csv ${sec}:`, r.status(), r.headers()['content-type'], '| rows:', t.split('\r\n').length - 1);
  }

  // ---- Bulk actions on applications
  await p.goto(B + '/admin/applications');
  const rows = await p.locator('tbody tr').count(); log('applications rows:', rows, '| checkboxes:', await p.locator('tbody input[type=checkbox]').count());
  await p.locator('tbody input[type=checkbox]').nth(0).check(); await p.locator('tbody input[type=checkbox]').nth(1).check();
  log('bar:', (await p.locator('[aria-label="Bulk actions"]').innerText()).split('\n')[0]);
  await p.selectOption('#bulk-op', 'status'); await p.selectOption('#bulk-value', 'shortlisted'); await p.click('[aria-label="Bulk actions"] button:has-text("Apply")');
  log('confirm:', await p.textContent('#confirm-title'), '|', (await p.locator('[role=dialog] p').textContent()).slice(0, 60));
  await p.click('[role=dialog] button:has-text("Continue")'); await toast(p, 'Moved 2 of 2 applications to Shortlisted'); await p.waitForTimeout(800);
  log('shortlisted after:', await p.locator('tbody >> text=Shortlisted').count(), '| bar gone:', await p.locator('[aria-label="Bulk actions"]').count() === 0);
  // Select all on the page, tag + follow-up + assign
  await p.locator('thead input[type=checkbox]').check(); log('page selected:', (await p.locator('[aria-label="Bulk actions"] strong').textContent()));
  await p.selectOption('#bulk-op', 'tag'); await p.fill('#bulk-value', 'Q4 drive'); await p.click('[aria-label="Bulk actions"] button:has-text("Apply")'); await p.click('[role=dialog] button:has-text("Continue")');
  await toast(p, 'Tagged'); await p.waitForTimeout(600);
  await p.locator('thead input[type=checkbox]').check();
  await p.selectOption('#bulk-op', 'followup'); await p.fill('#bulk-value', iso(3)); await p.click('[aria-label="Bulk actions"] button:has-text("Apply")'); await p.click('[role=dialog] button:has-text("Continue")');
  await toast(p, 'Follow-up set'); await p.waitForTimeout(600);
  await p.locator('tbody input[type=checkbox]').nth(0).check();
  await p.selectOption('#bulk-op', 'assign'); await p.selectOption('#bulk-value', { label: 'Test Owner' }); await p.click('[aria-label="Bulk actions"] button:has-text("Apply")'); await p.click('[role=dialog] button:has-text("Continue")');
  await p.waitForSelector('text=/Assigned 1 of 1 application to Test Owner|Nothing changed/'); log('assign done');
  // Cancel in the dialog changes nothing
  await p.locator('tbody input[type=checkbox]').nth(0).check(); await p.selectOption('#bulk-op', 'status'); await p.selectOption('#bulk-value', 'rejected');
  await p.click('[aria-label="Bulk actions"] button:has-text("Apply")'); await p.click('[role=dialog] button:has-text("Cancel")'); await p.waitForTimeout(400);
  log('cancel kept selection:', await p.locator('[aria-label="Bulk actions"]').count(), '| rejected:', await p.locator('tbody >> text=Rejected').count());
  await p.click('[aria-label="Bulk actions"] button:has-text("Clear")');
  await shot(p, '75-applications-bulk');

  // ZIP of resumes for the whole page
  await p.locator('thead input[type=checkbox]').check(); await p.selectOption('#bulk-op', 'zip');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[aria-label="Bulk actions"] button:has-text("Download")')]);
  const zpath = OUT + '/resumes.zip'; await dl.saveAs(zpath);
  log('zip name:', dl.suggestedFilename());
  log('zip test:', execFileSync('python3', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print(z.testzip() or "ok", sorted(z.namelist()), [z.read(n)[:5] for n in z.namelist()][:2])', zpath]).toString().trim());
  await toast(p, 'Downloaded');
  // CSV of the selection
  await p.locator('thead input[type=checkbox]').check(); await p.locator('tbody input[type=checkbox]').nth(0).uncheck(); await p.selectOption('#bulk-op', 'export');
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('[aria-label="Bulk actions"] button:has-text("Download")')]);
  const csv = fs.readFileSync(await dl2.path(), 'utf8'); log('csv selection rows:', csv.split('\r\n').length - 1, 'of', rows - 1, '| name:', dl2.suggestedFilename());
  // Timeline shows bulk changes
  await p.goto(prof); log('profile tag shown:', await p.locator('text=Q4 drive').count() > 0);
  // Forged requests
  const noOrigin = await p.request.post(B + '/admin/api/resumes-zip', { form: { ids: 'x' }, headers: { origin: 'https://evil.example.test' } }); log('zip from another origin:', noOrigin.status());

  // ---- Viewer
  const { p: v } = await login(b, 'viewer@example.test', 'blue-river-4821', '203.0.113.52');
  log('viewer nav has Analytics:', (await v.textContent('aside nav')).includes('Analytics'), '| Tasks:', (await v.textContent('aside nav')).includes('Tasks'));
  await v.goto(B + '/admin/analytics'); log('viewer analytics ->', v.url().replace(B, ''));
  log('viewer analytics csv:', (await v.request.get(B + '/admin/api/analytics-export?section=sources')).status());
  await v.goto(B + '/admin/applications'); log('viewer checkboxes:', await v.locator('tbody input[type=checkbox]').count());
  log('viewer zip:', (await v.request.post(B + '/admin/api/resumes-zip', { form: { all: '1' }, headers: { origin: B } })).status());
  await v.goto(B + '/admin/tasks'); log('viewer tasks:', await v.locator('button[aria-label^="Mark done:"]').count(), '| owner selector:', await v.locator('#who').count(), '| owner field:', await v.locator('#tk-owner').count());
  await v.click('button[aria-label="Mark done: Review the viewer access"]'); await v.waitForTimeout(800);

  // ---- Cron reminders -> notifications
  const cron = await p.request.get(B + '/api/cron/reminders', { headers: { authorization: 'Bearer test-cron-secret-1234567' } });
  log('cron:', cron.status(), await cron.text());
  const cron2 = await p.request.get(B + '/api/cron/reminders', { headers: { authorization: 'Bearer test-cron-secret-1234567' } });
  log('cron again:', await cron2.text());
  await p.goto(B + '/admin/notifications'); log('owner notifications:', (await p.locator('main li').allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim().slice(0, 70)).slice(0, 4));
  await p.goto(B + '/admin/tasks?who=all&status=done'); log('creator sees viewer finished:', await p.locator('button[aria-label="Reopen: Review the viewer access"]').count());

  // ---- Mobile + dark
  const state = await ctx.storageState();
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, storageState: state, extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.51' } })).newPage();
  for (const [u, nm] of [['/admin/tasks', '76-tasks-mobile'], ['/admin/analytics?range=all', '77-analytics-mobile']]) {
    await m.goto(B + u); await shot(m, nm); log(nm, 'overflow', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  }
  await m.goto(B + '/admin/applications'); await m.locator('tbody input[type=checkbox]').nth(0).check(); await m.selectOption('#bulk-op', 'status');
  await m.locator('[aria-label="Bulk actions"]').scrollIntoViewIfNeeded(); await m.screenshot({ path: SHOTS + '/admin/78-bulk-mobile.png' });
  log('78-bulk-mobile overflow', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  const d = await (await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', storageState: state, extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.51' } })).newPage();
  await d.goto(B + '/admin/analytics?range=all'); await d.waitForTimeout(300); await shot(d, '79-analytics-dark');
  await d.goto(B + '/admin/tasks?who=all'); await shot(d, '80-tasks-dark');
  log('errors:', errs.join(' | ') || 'none');
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
