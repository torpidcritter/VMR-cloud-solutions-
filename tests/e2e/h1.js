// Browser checks for hardening milestone H1.
const { chromium } = require('playwright');
const fs = require('fs');
const { B, SHOTS, FIX, OUT, SERVER_LOG, ok } = require('./env');
const shot = async (p, name) => p.screenshot({ path: `${SHOTS}/hardening/${name}.png`, fullPage: true });
const log = (...a) => console.log(...a);
async function login(b, email, password, xff) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { 'x-forwarded-for': xff } });
  const p = await ctx.newPage();
  await p.goto(B + '/admin/login'); await p.fill('#email', email); await p.fill('#password', password); await p.click('button[type=submit]');
  await p.waitForURL(/\/admin(\?.*)?$|change-password/, { timeout: 8000 }).catch(() => {});
  return { ctx, p };
}
function zip(names) {
  const locals = [], centrals = []; let offset = 0;
  for (const name of names) {
    const n = Buffer.from(name), data = Buffer.from('<x/>');
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(20, 4); l.writeUInt32LE(data.length, 18); l.writeUInt32LE(data.length, 22); l.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    locals.push(l, n, data); centrals.push(c, n); offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals); const e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(names.length, 8); e.writeUInt16LE(names.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, e]);
}
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

(async () => {
  const b = await chromium.launch();
  const errs = [];
  const watch = (p) => { p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(`${p.url()}: ${m.text()}`)); };

  // ---- Public careers form: macro file refused, then a submission the network sends twice
  const run = Math.floor(Math.random() * 200) + 20;
  const email = `retry.${run}@example.test`;
  const pub = await (await b.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-for': `198.51.${run}.81` } })).newPage();
  const fill = async () => {
    await pub.goto(B + '/careers'); await pub.waitForTimeout(3000); // the form counts time on page
    await pub.fill('#fullName', 'Retry Tester'); await pub.fill('#c-email', email); await pub.fill('#c-phone', '+91 90000 55555');
    await pub.selectOption('#position', 'Other'); await pub.selectOption('#experience', '3–5 years'); await pub.check('input[name=consent]');
  };
  await fill();
  await pub.setInputFiles('#resume', { name: 'cv.docx', mimeType: DOCX, buffer: zip(['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/vbaProject.bin']) });
  await pub.click('form button[type=submit]'); await pub.waitForTimeout(1500);
  ok('macro file refused with a message', (await pub.textContent('main')).includes('active content'));
  await shot(pub, 'h1-01-macro-refused');

  await fill();
  await pub.setInputFiles('#resume', FIX + '/test-cv.pdf');
  // The page's own request is sent twice with the same body, as a network retry would.
  await pub.evaluate(() => {
    const orig = window.fetch;
    window.fetch = async (u, o) => {
      if (String(u).includes('/api/careers')) {
        window.__key = o.body.get('submissionId');
        const r1 = await orig(u, o); const r2 = await orig(u, o);
        window.__statuses = [r1.status, r2.status];
        return r2;
      }
      return orig(u, o);
    };
  });
  await pub.click('form button[type=submit]'); await pub.waitForTimeout(2500);
  const sent = await pub.evaluate(() => ({ key: window.__key, statuses: window.__statuses }));
  ok('form sends a submission id', /^[0-9a-f-]{36}$/.test(sent.key || '')); ok('both sends answered', (sent.statuses || []).join(','), '200,200'); ok('thank-you shown', /thank/i.test(await pub.textContent('main')));
  await shot(pub, 'h1-01b-retry-thanks');


  // ---- Admin: one application, stage rules on the detail page
  const { p } = await login(b, 'owner@example.test', 'test-pass-1234', '198.51.100.82'); watch(p);
  await p.goto(B + '/admin/applications?q=' + encodeURIComponent(email));
  const found = await p.locator('tbody tr').count();
  ok('one application saved for the retried submission', found, 1);
  await p.locator('tbody tr a').first().click(); await p.waitForURL(/applications\/[0-9a-f-]{36}/);
  const appUrl = p.url().split('?')[0];
  const chips = async () => (await p.locator('section:has(h2:text-is("Status")) .a-chip').allInnerTexts()).map((t) => t.trim());
  let c = await chips(); log('chips on New:', c.join(' | ')); ok('Hired not offered on New', c.includes('Hired'), false);
  await shot(p, 'h1-02-stage-chips-new');
  await p.goto(appUrl + '?refused=1'); ok('refused notice', (await p.textContent('main')).includes('stage change isn’t allowed'));
  await p.goto(appUrl);
  await p.click('section:has(h2:text-is("Status")) button:has-text("Interview completed")'); await p.waitForTimeout(1200);
  c = await chips(); ok('Hired offered after interview', c.includes('Hired'));
  await p.click('section:has(h2:text-is("Status")) button:has-text("Hired")'); await p.waitForTimeout(1200);
  c = await chips(); ok('chips on Hired (super admin)', c.join(' | '), 'Offer Released | Hired');
  ok('no delete panel on Hired', await p.locator('h2:text-is("Delete")').count(), 0);
  await shot(p, 'h1-03-hired');

  // ---- Pipeline board: no Hired option for a card that hasn't been interviewed
  await p.goto(B + '/admin/pipeline'); await p.waitForTimeout(800);
  const opts = await p.$$eval('select', (ss) => ss.map((s) => ({ status: s.value, hired: [...s.options].some((o) => o.value === 'hired') })));
  const bad = opts.filter((o) => o.hired && !['interview_completed', 'selected', 'offer_released', 'hired'].includes(o.status));
  ok('pipeline cards offering an invalid Hired move', bad.length, 0);

  // ---- Bulk: moving everything on the page to Hired moves only eligible ones
  await p.goto(B + '/admin/applications');
  await p.locator('thead input[type=checkbox]').check();
  await p.selectOption('#bulk-op', 'status'); await p.selectOption('#bulk-value', 'hired');
  await p.click('[aria-label="Bulk actions"] button:has-text("Apply")');
  if (await p.locator('[role=dialog]').count()) await p.click('[role=dialog] button:has-text("Continue")');
  await p.waitForTimeout(1500);
  const toastText = await p.locator('text=/Moved \\d+ of|None moved/').first().textContent().catch(() => '(no message)');
  ok('bulk Hired skips ineligible applications', toastText, (t) => /None moved|left as/.test(t));
  await shot(p, 'h1-04-bulk-hired');

  ok('no page or console errors', errs, []);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
