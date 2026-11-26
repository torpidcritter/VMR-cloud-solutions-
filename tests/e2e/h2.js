// Browser checks for hardening milestone H2.
const { chromium } = require('playwright');
const crypto = require('crypto');
const { B, SHOTS, FIX, OUT, SERVER_LOG, ok } = require('./env');
const shot = async (p, name) => p.screenshot({ path: `${SHOTS}/hardening/${name}.png`, fullPage: true });
const log = (...a) => console.log(...a);
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32(s) { let bits = 0, v = 0; const out = []; for (const ch of s.replace(/\s/g, '')) { v = (v << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }
function code(secret, offset = 0) {
  const step = Math.floor(Date.now() / 30000) + offset; const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(step));
  const m = crypto.createHmac('sha1', b32(secret)).update(c).digest(); const o = m[m.length - 1] & 15;
  return String((((m[o] & 127) << 24) | (m[o + 1] << 16) | (m[o + 2] << 8) | m[o + 3]) % 1e6).padStart(6, '0');
}
async function login(b, email, password, xff) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-for': xff } });
  const p = await ctx.newPage();
  await p.goto(B + '/admin/login'); await p.fill('#email', email); await p.fill('#password', password); await p.click('button[type=submit]');
  await p.waitForURL(/\/admin(\/login\/verify.*|\?.*)?$|change-password|security/, { timeout: 8000 }).catch(() => {});
  return { ctx, p };
}

(async () => {
  const b = await chromium.launch();
  const errs = [];
  const watch = (p) => { p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(`${p.url()}: ${m.text()}`)); };
  const run = Math.floor(Math.random() * 200) + 20;
  // Unique per run, so a database that already holds earlier runs can't match an old record.
  const uniq = `${run}-${Date.now().toString(36)}`;

  // ---- Consent on the careers form, and the contact page map under the CSP
  const pub = await (await b.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-for': `198.51.${run}.91` } })).newPage(); watch(pub);
  await pub.goto(B + '/careers'); await pub.waitForTimeout(3000);
  await pub.fill('#fullName', 'Consent Tester'); await pub.fill('#c-email', `consent.${uniq}@example.test`); await pub.fill('#c-phone', '+91 90000 66666');
  await pub.selectOption('#position', 'Other'); await pub.selectOption('#experience', '3–5 years'); await pub.setInputFiles('#resume', FIX + '/test-cv.pdf');
  await pub.click('form button[type=submit]'); await pub.waitForTimeout(800);
  ok('consent required', (await pub.textContent('main')).includes('agree to us processing'));
  await pub.locator('input[name=consent]').scrollIntoViewIfNeeded(); await shot(pub, 'h2-01-careers-consent');
  await pub.check('input[name=consent]'); await pub.click('form button[type=submit]'); await pub.waitForTimeout(2500);
  ok('submitted with consent', /thank|received/i.test(await pub.textContent('main')));
  await pub.goto(B + '/contact'); await pub.waitForTimeout(1500);
  ok('contact page maps load under the CSP', await pub.locator('iframe').count(), (n) => n >= 1);

  // ---- Owner: consent recorded, Export data, then two-step sign-in set-up
  const { ctx, p } = await login(b, 'owner@example.test', 'test-pass-1234', `198.51.${run}.92`); watch(p);
  await p.goto(B + '/admin/applications?q=' + encodeURIComponent(`consent.${uniq}@example.test`));
  await p.locator('tbody tr a').first().click(); await p.waitForURL(/applications\/[0-9a-f-]{36}/);
  const appText = await p.textContent('main');
  ok('consent shown on application', appText.includes('Consent (policy version)'));
  await p.click('a:has-text("Candidate profile")'); await p.waitForURL(/candidates\/[0-9a-f-]{36}/);
  const candUrl = p.url();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('a:has-text("Export data")')]);
  const json = JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8'));
  ok('export has the application', json.applications.length, 1); ok('export includes consent', JSON.stringify(json).includes('consentVersion'));

  await p.goto(B + '/admin/security'); await shot(p, 'h2-02-security-off');
  await p.click('button:has-text("Set up two-step sign-in")'); await p.waitForURL(/setup=1/);
  const key = (await p.locator('code').first().textContent()).replace(/\s/g, '');
  ok('QR code shown', await p.locator('[aria-label="QR code for your authenticator app"] svg').count(), 1); ok('key length', key.length, 32);
  await shot(p, 'h2-03-security-scan');
  await p.fill('#code', '000000'); await p.click('button:has-text("Turn on two-step sign-in")'); await p.waitForTimeout(800);
  ok('wrong setup code refused', (await p.textContent('main')).includes("didn't match"));
  await p.fill('#code', code(key)); await p.click('button:has-text("Turn on two-step sign-in")');
  await p.waitForSelector('[aria-label="Recovery codes"]'); const recovery = await p.locator('[aria-label="Recovery codes"] li').allInnerTexts();
  ok('ten recovery codes shown', recovery.length, 10); await shot(p, 'h2-04-recovery-codes');
  await ctx.close();

  // ---- Sign in again: password, then code
  const again = await login(b, 'owner@example.test', 'test-pass-1234', `198.51.${run}.93`); watch(again.p);
  ok('asked for a code after the password', again.p.url().includes('/admin/login/verify')); await shot(again.p, 'h2-05-verify');
  await again.p.goto(B + '/admin'); ok('panel blocked before the code', again.p.url().includes('/admin/login'));
  await again.p.goto(B + '/admin/login/verify');
  await again.p.fill('#code', '111111'); await again.p.click('button[type=submit]'); await again.p.waitForTimeout(800);
  ok('wrong code refused', (await again.p.textContent('main')).includes("That code isn't right"));
  await again.p.fill('#code', recovery[0]); await again.p.click('button[type=submit]'); await again.p.waitForURL(/\/admin$/, { timeout: 8000 }).catch(() => {});
  ok('signed in with a recovery code', again.p.url().endsWith('/admin'));
  await again.p.goto(B + '/admin/activity?tab=signins'); ok('sign-ins list shows the wrong code', (await again.p.textContent('main')).includes('Wrong two-step code'));

  // ---- Edit conflict: two people edit the same profile
  const e1 = again.p; const other = await again.ctx.newPage();
  await e1.goto(candUrl + '?edit=1'); await other.goto(candUrl + '?edit=1');
  await e1.fill('#p-location', 'Pune'); await e1.click('button:has-text("Save")'); await e1.waitForTimeout(1200);
  await other.fill('#p-location', 'Chennai'); await other.click('button:has-text("Save")'); await other.waitForTimeout(1200);
  ok('second editor told about the conflict', (await other.textContent('main')).includes('saved changes to this profile'));
  await other.locator('[role=alert]').first().scrollIntoViewIfNeeded().catch(() => {}); await shot(other, 'h2-06-edit-conflict');

  // ---- Turn two-step sign-in off again so the other scripts can sign in with a password only
  await e1.goto(B + '/admin/security');
  await e1.fill('#off-password', 'test-pass-1234'); await e1.fill('#off-code', code(key, 1)); await e1.click('button:has-text("Turn off two-step sign-in")'); await e1.waitForTimeout(1200);
  await e1.goto(B + '/admin/security'); ok('two-step sign-in turned off again', (await e1.locator('button:has-text("Set up two-step sign-in")').count()), 1);

  // ---- Viewer: masked contact details
  const v = await login(b, 'viewer@example.test', 'blue-river-4821', `198.51.${run}.94`); watch(v.p);
  await v.p.goto(B + '/admin/applications'); const list = await v.p.textContent('tbody');
  ok('viewer sees no full emails', /[a-z0-9.]{3,}@example\.test/.test(list), false); ok('viewer sees masked emails', list.includes('•••@'));
  await v.p.locator('tbody tr a').first().click(); await v.p.waitForURL(/applications\/[0-9a-f-]{36}/);
  ok('viewer has no Email or Call links', await v.p.locator('a[href^="mailto:"], a[href^="tel:"]').count(), 0);
  await shot(v.p, 'h2-07-viewer-masked');
  ok('viewer has no Export data', await v.p.locator('a:has-text("Export data")').count(), 0);
  const r = await v.ctx.request.get(B + '/admin/api/candidate-export/' + candUrl.split('/').pop()); ok('viewer export route refused', r.status(), 403);

  ok('no page or console errors', errs, []);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
