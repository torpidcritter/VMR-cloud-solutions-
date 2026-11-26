const { chromium, request } = require('playwright');
const { B, SHOTS, FIX, OUT, SERVER_LOG, ok } = require('./env');
const shot = async (p, name) => p.screenshot({ path: `${SHOTS}/admin/${name}.png`, fullPage: true });
const log = (...a) => console.log(...a);
const istDay = (plus) => new Date(Date.now() + 5.5 * 3600_000 + plus * 86_400_000).toISOString().slice(0, 10);
const T1 = istDay(1), T2 = istDay(2);

async function login(b, email, password, xff, extra = {}) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { 'x-forwarded-for': xff }, ...extra });
  const p = await ctx.newPage();
  await p.goto(B + '/admin/login'); await p.fill('#email', email); await p.fill('#password', password); await p.click('button[type=submit]');
  await p.waitForURL(/\/admin(\?.*)?$/);
  return { ctx, p };
}

(async () => {
  const b = await chromium.launch();
  const { ctx, p } = await login(b, 'owner@example.test', 'test-pass-1234', '203.0.113.21');
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));

  // Nav
  log('nav has My work + Interviews:', (await p.textContent('aside nav')).includes('My work'), (await p.textContent('aside nav')).includes('Interviews'));

  // Schedule from an application
  await p.goto(B + '/admin/applications?q=candidate%40example.test');
  await p.click('tbody tr a >> nth=0'); await p.waitForURL(/applications\/[0-9a-f-]{36}/); const appA = p.url();
  log('schedule form open by default:', await p.locator('details#schedule[open]').count());
  await p.fill('#iv-round', 'Technical round 1'); await p.fill('#iv-date', T1); await p.fill('#iv-time', '11:00');
  await p.fill('#iv-location', 'zoom'); await p.click('button:has-text("Schedule interview")');
  await p.waitForSelector('p[role=alert]'); log('bad link error:', await p.textContent('p[role=alert]'), '| round kept:', await p.inputValue('#iv-round'));
  await p.fill('#iv-location', 'https://meet.example.test/abc-defg-hij');
  await p.click('button:has-text("Schedule interview")'); await p.waitForSelector('text=Interview scheduled.', { timeout: 8000 });
  await p.waitForTimeout(600);
  log('app status now:', await p.locator('text=Interview Scheduled').count() > 0, '| interview listed:', await p.locator('a[href^="/admin/interviews/"]').count());
  await shot(p, '30-application-interviews');

  // Conflict on a second application with the same interviewer
  await p.goto(B + '/admin/applications?q=second'); await p.click('tbody tr a >> nth=0'); await p.waitForURL(/applications\/[0-9a-f-]{36}/); const appB = p.url();
  await p.fill('#iv-round', 'Technical round 1'); await p.fill('#iv-date', T1); await p.fill('#iv-time', '11:30'); await p.selectOption('#iv-duration', '30');
  const ownerChip = p.locator('label.a-chip:has-text("Test Owner") input');
  if (!(await ownerChip.isChecked())) await p.click('label.a-chip:has-text("Test Owner")');
  await p.click('button:has-text("Schedule interview")'); await p.waitForSelector('p[role=alert]');
  log('conflict:', await p.textContent('p[role=alert]'));
  await shot(p, '31-conflict-warning');
  await p.check('input[name=allowConflicts]'); await p.click('button:has-text("Schedule interview")'); await p.waitForSelector('text=Interview scheduled.', { timeout: 8000 });
  log('scheduled anyway');
  // A third one to cancel
  await p.waitForTimeout(500);
  await p.click('details#schedule summary'); await p.fill('#iv-round', 'HR round'); await p.fill('#iv-date', T2); await p.fill('#iv-time', '15:00');
  await p.selectOption('#iv-mode', 'phone');
  await p.click('button:has-text("Schedule interview")'); await p.waitForSelector('text=Interview scheduled.', { timeout: 8000 });

  // Calendar views
  await p.goto(B + '/admin/interviews'); await shot(p, '32-interviews-agenda'); log('agenda rows:', await p.locator('a[href^="/admin/interviews/"]').count());
  await p.goto(B + '/admin/interviews?view=month'); await shot(p, '33-interviews-month'); log('month view items:', await p.locator('a[href^="/admin/interviews/"]').count());

  // Interview page: calendar file, feedback completes it
  await p.goto(appA); await p.click('a[href^="/admin/interviews/"] >> nth=0'); await p.waitForURL(/interviews\/[0-9a-f-]{36}/); const ivA = p.url();
  const ics = await p.request.get(ivA.replace('/admin/interviews/', '/admin/api/interviews/') + '/ics');
  const icsText = await ics.text();
  log('ics', ics.status(), ics.headers()['content-type'], ics.headers()['content-disposition'], 'has VEVENT:', icsText.includes('BEGIN:VEVENT'), 'client leaked:', icsText.includes('Example Client'));
  await shot(p, '34-interview-page');
  await p.click('button:has-text("Save feedback")'); await p.waitForSelector('p[role=alert]'); log('empty feedback:', await p.textContent('p[role=alert]'));
  await p.click('label.a-chip:has-text("4")'); await p.click('label.a-chip:has-text("Yes") >> nth=0');
  await p.fill('#fb-notes', 'Strong on GL and asset accounting; probe cutover experience next round.');
  await p.click('button:has-text("Save feedback")'); await p.waitForSelector('text=Feedback saved.', { timeout: 8000 }); await p.waitForTimeout(600);
  log('after feedback completed:', await p.locator('text=Completed').count() > 0, '| avg shown:', (await p.content()).includes('4.0'));
  await shot(p, '35-interview-feedback');
  await p.goto(appA); log('app moved to Interview Completed:', await p.locator('text=Interview Completed').count() > 0);

  // Cancel the HR round with a reason
  await p.goto(B + '/admin/interviews'); await p.click('a[href^="/admin/interviews/"]:has-text("HR round")'); await p.waitForURL(/interviews\/[0-9a-f-]{36}/);
  await p.fill('#reason', 'Candidate asked to move it'); await p.click('button:has-text("Cancel interview")'); await p.waitForTimeout(1200);
  log('cancelled shown:', await p.locator('text=Cancelled').count() > 0, 'reason shown:', await p.locator('text=Candidate asked to move it').count());

  // Reschedule the remaining one from its page
  await p.goto(B + '/admin/interviews'); await p.click('a[href^="/admin/interviews/"]:has-text("Second Tester") >> nth=0'); await p.waitForURL(/interviews\/[0-9a-f-]{36}/);
  const rsSummary = p.locator('summary:has-text("Reschedule")'); if (await rsSummary.count()) await rsSummary.click();
  await p.fill('#rs-time', '16:00'); await p.click('button:has-text("Save changes")'); await p.waitForSelector('text=Interview updated.', { timeout: 8000 });
  await p.goto(appB); log('reschedule on history:', await p.locator('text=moved from').count());

  // Target + My work
  await p.goto(B + '/admin/users'); await p.click('a:has-text("Test Owner")'); await p.waitForURL(/users\/[0-9a-f-]{36}/);
  await p.fill('#placements', '-2'); await p.click('button:has-text("Save target")'); await p.waitForSelector('p[role=alert]'); log('bad target:', await p.textContent('p[role=alert]'));
  await p.fill('#placements', '3'); await p.click('button:has-text("Save target")'); await p.waitForSelector('text=Target saved.', { timeout: 8000 });
  await shot(p, '36-user-target');
  await p.goto(B + '/admin/my-work'); const mw = await p.textContent('main');
  log('my work: target shown', /0 \/ 3/.test(mw), '| interviews panel has Second Tester', mw.includes('Second Tester'));
  await shot(p, '37-my-work');
  await p.goto(B + '/admin/activity'); log('activity interview links:', await p.locator('a[href^="/admin/interviews/"]').count());

  // Viewer
  const { p: v } = await login(b, 'viewer@example.test', 'blue-river-4821', '203.0.113.22');
  await v.goto(appA); log('viewer schedule form:', await v.locator('details#schedule').count());
  await v.goto(ivA); log('viewer outcome/feedback controls:', await v.locator('button:has-text("Cancel interview")').count() + await v.locator('button:has-text("Save feedback")').count());
  await v.goto(B + '/admin/my-work'); log('viewer my work loads:', v.url().endsWith('/admin/my-work'));
  const vUser = await v.request.get(B + '/admin/users'); log('viewer users page final url:', vUser.url());

  // Cron
  const api = await request.newContext({ baseURL: B });
  let r = await api.get('/api/cron/reminders'); log('cron no auth', r.status());
  r = await api.get('/api/cron/reminders', { headers: { authorization: 'Bearer test-cron-secret-1234567' } }); log('cron run 1', r.status(), await r.text());
  r = await api.get('/api/cron/reminders', { headers: { authorization: 'Bearer test-cron-secret-1234567' } }); log('cron run 2', r.status(), await r.text());

  // Mobile + dark
  const state = await ctx.storageState();
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, storageState: state, extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.21' } })).newPage();
  for (const [u, n] of [['/admin/interviews', '38-interviews-mobile'], ['/admin/interviews?view=month', '39-month-mobile'], ['/admin/my-work', '40-my-work-mobile'], [ivA.replace(B, ''), '41-interview-mobile']]) {
    await m.goto(B + u); await shot(m, n); log(n, 'overflow', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  }
  const d = await (await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', storageState: state, extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.21' } })).newPage();
  await d.goto(B + '/admin/my-work'); await d.waitForTimeout(300); await shot(d, '42-my-work-dark');
  await d.goto(B + '/admin/interviews?view=month'); await shot(d, '43-month-dark');
  log('errors:', errs.join(' | ') || 'none');
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
