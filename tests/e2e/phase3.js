const { chromium } = require('playwright');
const { B, SHOTS, FIX, OUT, SERVER_LOG, ok } = require('./env');
const E = FIX;
const shot = async (p, name) => p.screenshot({ path: `${SHOTS}/admin/${name}.png`, fullPage: true });
const log = (...a) => console.log(...a);
async function login(b, email, password, xff, extra = {}) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { 'x-forwarded-for': xff }, ...extra });
  const p = await ctx.newPage();
  await p.goto(B + '/admin/login'); await p.fill('#email', email); await p.fill('#password', password); await p.click('button[type=submit]');
  await p.waitForURL(/\/admin(\?.*)?$/);
  return { ctx, p };
}
const toast = (p, text) => p.waitForSelector(`text=${text}`, { timeout: 10000 });

(async () => {
  const b = await chromium.launch();
  const { ctx, p } = await login(b, 'owner@example.test', 'test-pass-1234', '203.0.113.31');
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));

  // Add a sourced candidate with a resume
  await p.goto(B + '/admin/candidates'); await p.click('a:has-text("Add candidate")'); await p.waitForURL(/candidates\/new/);
  await p.click('button:has-text("Add to Talent Bank")'); await p.waitForSelector('p[role=alert]');
  log('empty form errors:', await p.locator('[aria-invalid=true]').count());
  await p.fill('#nc-fullName', 'Sourced Tester'); await p.fill('#nc-email', 'sourced.tester@example.test'); await p.fill('#nc-location', 'Bengaluru');
  await p.fill('#nc-currentTitle', 'SAP FICO Consultant'); await p.fill('#nc-experienceYears', '7'); await p.fill('#nc-skills', 'SAP FI, SAP CO');
  await p.setInputFiles('#nc-file', `${E}/resume-chromium.pdf`);
  await shot(p, '50-new-candidate');
  await p.click('button:has-text("Add to Talent Bank")'); await p.waitForURL(/candidates\/[0-9a-f-]{36}\?created=1/); const prof = p.url().split('?')[0];
  log('created notice:', await p.locator('text=Added to the Talent Bank.').count(), '| resume searchable:', await p.locator('text=searchable').count());

  // Duplicate email
  await p.goto(B + '/admin/candidates/new'); await p.fill('#nc-fullName', 'Sourced Again'); await p.fill('#nc-email', 'SOURCED.TESTER@example.test');
  await p.click('button:has-text("Add to Talent Bank")'); await p.waitForSelector('p[role=alert]');
  log('duplicate:', await p.textContent('p[role=alert]'), '| link to existing:', await p.locator('a:has-text("Open their existing profile")').count());

  // Uploads on the profile: a fake PDF is refused, a DOCX is accepted
  await p.goto(prof);
  await p.setInputFiles('#upload-file', `${E}/fake.pdf`); await p.click('button:has-text("Upload")'); await p.waitForSelector('p[role=alert]');
  log('fake pdf:', await p.locator('#upload-file ~ p, form:has(#upload-file) p.text-accent-600').last().textContent());
  await p.setInputFiles('#upload-file', `${E}/resume.docx`); await p.click('button:has-text("Upload")'); await toast(p, 'Resume uploaded.');
  await p.waitForTimeout(600); log('resumes listed:', await p.locator('a[href^="/admin/api/candidate-files/"][aria-label^="Download"]').count());
  const fileHref = await p.locator('a[href^="/admin/api/candidate-files/"][aria-label^="Download"]').first().getAttribute('href');
  const dl = await p.request.get(B + fileHref);
  log('download', dl.status(), dl.headers()['content-type'], dl.headers()['cache-control']);

  // Resume search
  await p.goto(B + '/admin/candidates?resume=%22asset+accounting%22'); log('resume search rows:', await p.locator('tbody tr').count(), (await p.textContent('tbody')).includes('Sourced Tester'));
  await p.goto(B + '/admin/candidates?resume=payroll'); log('no-hit search rows:', await p.locator('tbody tr').count());
  await p.goto(B + '/admin/candidates?contacted=never'); log('never contacted rows:', await p.locator('tbody tr').count());

  // Pools
  await p.goto(B + '/admin/talent-pools'); await shot(p, '51-pools-empty');
  await p.fill('#pool-name', 'FICO Bengaluru'); await p.fill('#pool-description', 'Finance consultants open to Bengaluru roles'); await p.click('button:has-text("Create pool")');
  await p.waitForURL(/talent-pools\/[0-9a-f-]{36}/); const poolUrl = p.url();
  await p.goto(B + '/admin/talent-pools'); await p.fill('#pool-name', 'fico bengaluru'); await p.click('button:has-text("Create pool")'); await p.waitForSelector('p[role=alert]');
  log('duplicate pool name:', await p.locator('text=A pool with this name already exists.').count());
  await p.goto(B + '/admin/candidates?skill=SAP+FI'); const n = await p.locator('tbody tr').count();
  await p.selectOption('#bulk-pool', { label: 'FICO Bengaluru' }); await p.click('form:has(#bulk-pool) button'); await toast(p, 'to the pool');
  log('bulk add, rows', n, ':', await p.locator('text=/Added \\d+ candidate/').first().textContent().catch(() => '?'));
  await shot(p, '52-candidates-bulk-pool');
  await p.goto(poolUrl); log('pool members:', await p.locator('tbody tr').count()); await shot(p, '53-pool');
  await p.goto(prof); await p.click(`button[aria-label="Remove from FICO Bengaluru"]`); await p.waitForTimeout(1000);
  log('after remove chip:', await p.locator('a:has-text("FICO Bengaluru")').count());
  await p.selectOption('#add-pool', { label: 'FICO Bengaluru' }); await p.click('form:has(#add-pool) button'); await toast(p, 'Added to the pool.'); await p.waitForTimeout(500);
  log('after re-add chip:', await p.locator('ul a:has-text("FICO Bengaluru")').count());

  // Matching from the opening
  await p.goto(B + '/admin/openings'); await p.click('a:has-text("SAP S/4HANA FICO Consultant") >> nth=0'); await p.waitForURL(/openings\/[0-9a-f-]{36}/);
  const openingUrl = p.url().split('?')[0];
  await p.click('a:has-text("Find candidates")'); await p.waitForURL(/matches/);
  const first = await p.locator('ol > li').first().textContent();
  log('top match:', first.includes('Sourced Tester'), '| reasons shown:', await p.locator('ol > li').first().locator('ul li').count(), '| text:', first.replace(/\s+/g, ' ').slice(0, 200));
  await shot(p, '54-opening-matches');
  await p.locator('ol > li').first().locator('button:has-text("Put forward")').click(); await toast(p, 'pipeline'); await p.waitForTimeout(400);
  log('put forward toast:', await p.locator('text=/added to the .* pipeline/').first().textContent());
  await p.reload(); log('after reload still listed:', (await p.locator('ol').textContent().catch(() => '')).includes('Sourced Tester'), '| applied note:', (await p.textContent('main')).match(/(\d+) already applied/)?.[0]);
  await p.goto(prof); log('profile matching panel says in pipeline:', await p.locator('text=Already in this pipeline').count()); await shot(p, '55-profile-talent');
  await p.goto(B + '/admin/applications?q=sourced'); log('application source:', (await p.textContent('tbody')).includes('Added by recruiter'));

  // Settings: read older resumes
  await p.goto(B + '/admin/settings'); log('coverage:', (await p.locator('text=/of \\d+ resume/').first().textContent()).trim());
  if (await p.locator('button:has-text("Read the next 20")').count()) { await p.click('button:has-text("Read the next 20")'); await toast(p, 'Checked'); log('read older resumes ok'); }

  // Viewer
  const { p: v } = await login(b, 'viewer@example.test', 'blue-river-4821', '203.0.113.32');
  await v.goto(B + '/admin/candidates'); log('viewer add button:', await v.locator('a:has-text("Add candidate")').count(), '| bulk pool:', await v.locator('#bulk-pool').count());
  await v.goto(prof); log('viewer upload/pool/forward controls:', await v.locator('#upload-file').count() + await v.locator('#add-pool').count() + await v.locator('button:has-text("Put forward")').count() + await v.locator('button[aria-label^="Remove from"]').count());
  await v.goto(B + '/admin/candidates/new'); log('viewer new page ->', v.url().replace(B, ''));
  log('viewer file download', (await v.request.get(B + fileHref)).status());
  await v.goto(B + '/admin/talent-pools'); log('viewer pool form:', await v.locator('#pool-name').count());
  await v.goto(openingUrl + '/matches'); log('viewer matches page put-forward buttons:', await v.locator('button:has-text("Put forward")').count());

  // Mobile + dark
  const state = await ctx.storageState();
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, storageState: state, extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.31' } })).newPage();
  for (const [u, nm] of [[prof.replace(B, ''), '56-profile-talent-mobile'], [openingUrl.replace(B, '') + '/matches', '57-matches-mobile'], [poolUrl.replace(B, ''), '58-pool-mobile'], ['/admin/candidates/new', '59-new-candidate-mobile']]) {
    await m.goto(B + u); await shot(m, nm); log(nm, 'overflow', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  }
  const d = await (await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', storageState: state, extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.31' } })).newPage();
  await d.goto(openingUrl + '/matches'); await d.waitForTimeout(300); await shot(d, '60-matches-dark');
  log('errors:', errs.join(' | ') || 'none');
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
