const { chromium, request } = require('playwright');
const fs = require('fs');
const { B, SHOTS, FIX, OUT, SERVER_LOG, ok } = require('./env');
const pdf = Buffer.from(`%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n${'x'.repeat(64)}\ntrailer << /Root 1 0 R >>\n%%EOF\n`, 'latin1');
fs.writeFileSync(FIX + '/test-cv.pdf', pdf);
const shot = async (p, name) => p.screenshot({ path: `${SHOTS}/admin/${name}.png`, fullPage: true });
const log = (...a) => console.log(...a);

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));

  // Setup
  await p.goto(B + '/admin/login'); await shot(p, '01-login-empty');
  await p.click('text=Create the first Super Admin');
  await p.fill('#setupKey', 'wrong'); await p.fill('#name', 'Test Owner'); await p.fill('#email', 'owner@example.test');
  await p.fill('#password', 'test-pass-1234'); await p.fill('#confirm', 'test-pass-1234');
  await p.click('button[type=submit]'); await p.waitForSelector('p[role=alert]'); log('wrong key:', await p.textContent('p[role=alert]'));
  await p.fill('#setupKey', 'test-setup-key'); await p.fill('#password', 'test-pass-1234'); await p.fill('#confirm', 'test-pass-1234');
  await p.click('button[type=submit]'); await p.waitForURL(B + '/admin'); log('setup ->', p.url());
  await shot(p, '02-dashboard-empty');

  // Opening
  await p.goto(B + '/admin/openings/new');
  await p.fill('#title', 'SAP S/4HANA FICO Consultant'); await p.fill('#sap_module', 'FICO');
  await p.selectOption('#experience', '3–5 years'); await p.fill('#salary_range', '₹18–24 LPA');
  await p.fill('#client_name', 'Example Client Pvt Ltd'); await p.fill('#public_client_label', 'Leading global IT services company');
  await p.fill('#summary', 'Configure FI/CO on a large S/4HANA finance transformation.');
  await p.fill('#description', 'You will join a finance transformation programme moving to SAP S/4HANA.\n\nResponsibilities:\n- Configure GL, AP, AR and asset accounting\n- Support testing and cutover\n- Work with business users on requirements\n\nRequirements:\n- 3+ years of SAP FI/CO\n- At least one S/4HANA implementation');
  await p.fill('#skills', 'SAP FI, SAP CO, S/4HANA, Asset Accounting'); await p.selectOption('#status', 'published');
  await shot(p, '03-opening-form');
  await p.click('button:has-text("Create opening")'); await p.waitForURL(/\/admin\/openings\/[0-9a-f-]{36}/); log('created opening', p.url());
  let jobUrl = ''; const openingId = p.url().split('/').pop().split('?')[0];
  // A draft too
  await p.goto(B + '/admin/openings/new'); await p.fill('#title', 'ABAP Developer'); await p.fill('#public_client_label', 'VMR Cloud Solutions'); await p.selectOption('#experience', '1–3 years');
  await p.click('button:has-text("Create opening")'); await p.waitForURL(/created=1/);
  await p.goto(B + '/admin/openings'); await shot(p, '04-openings');

  // Public side
  const pub = await ctx.newPage();
  await pub.goto(B + '/careers'); await pub.waitForTimeout(800);
  const html = await pub.content(); log('careers shows job:', html.includes('SAP S/4HANA FICO Consultant'), 'client leaked:', html.includes('Example Client'), 'draft leaked:', html.includes('ABAP Developer'));
  await pub.locator('#openings').screenshot({ path: SHOTS + '/admin/05-careers-openings.png' });
  await pub.click('text=View and apply'); await pub.waitForURL(/\/careers\/sap-s4hana/); log('job page', pub.url()); jobUrl = pub.url(); 
  const jhtml = await pub.content(); log('jsonld:', jhtml.includes('"JobPosting"'), 'client leaked:', jhtml.includes('Example Client'));
  await pub.waitForTimeout(3000);
  await pub.fill('#fullName', 'Test Candidate'); await pub.fill('#c-email', 'candidate@example.test'); await pub.fill('#c-phone', '+91 90000 00000');
  await pub.selectOption('#experience', '3–5 years'); await pub.setInputFiles('#resume', FIX + '/test-cv.pdf');
  await pub.fill('#c-message', 'Five years of FI/CO, two S/4 projects.'); await pub.check('input[name=consent]');
  await shot(pub, '06-job-page');
  await pub.click('button:has-text("Submit Your Resume")'); await pub.waitForSelector('text=Application received', { timeout: 10000 }); log('applied via job page');

  // API submissions (careers general, contact, cv upload)
  const api = await request.newContext({ baseURL: B, extraHTTPHeaders: { origin: B, host: new URL(B).host } });
  const started = String(Date.now() - 60000);
  let r = await api.post('/api/careers', { multipart: { fullName: 'Test Candidate', email: 'CANDIDATE@example.test', phone: '+91 90000 00000', position: 'Java Development', experience: '3–5 years', message: '', startedAt: started, website: '', consent: 'yes', resume: { name: 'cv.pdf', mimeType: 'application/pdf', buffer: pdf } } });
  log('careers api', r.status(), await r.text());
  r = await api.post('/api/contact', { data: { name: 'Test Buyer', company: 'Example Corp', email: 'buyer@example.test', phone: '+91 80000 00000', service: 'Contract SAP Recruitment', requirement: 'Hire SAP contractors', message: 'We need three FICO contractors from January.', startedAt: Number(started), website: '' } });
  log('contact api', r.status(), await r.text());
  r = await api.post('/api/cv', { multipart: { fullName: 'Second Tester', email: 'second@example.test', phone: '+91 70000 00000', location: 'Hyderabad', preferredLocation: 'Bengaluru', specialisation: 'SAP ABAP', experience: '5–8 years', employmentType: 'Contract', consent: 'yes', startedAt: started, website: '', cv: { name: 'cv.pdf', mimeType: 'application/pdf', buffer: pdf } } });
  log('cv api', r.status(), await r.text());
  r = await api.post('/api/careers', { multipart: { openingId: '00000000-0000-0000-0000-000000000000', fullName: 'X Y', email: 'x@example.test', phone: '+91 90000 00000', position: 'Any', experience: '3–5 years', startedAt: started, website: '', consent: 'yes', resume: { name: 'cv.pdf', mimeType: 'application/pdf', buffer: pdf } } });
  log('closed opening api', r.status());

  // Admin views
  await p.goto(B + '/admin'); await shot(p, '07-dashboard');
  await p.goto(B + '/admin/applications'); await shot(p, '08-applications');
  const rows = await p.locator('tbody tr').count(); log('applications rows', rows);
  await p.goto(B + '/admin/applications?q=%232'); log('search #2 rows', await p.locator('tbody tr').count());
  await p.goto(B + `/admin/applications?opening=${openingId}`); log('by opening rows', await p.locator('tbody tr').count());
  await p.goto(B + '/admin/applications?range=today'); log('today rows', await p.locator('tbody tr').count());
  await p.goto(B + '/admin/applications');
  await p.click('tbody tr:last-child a >> nth=0'); await p.waitForURL(/applications\/[0-9a-f-]{36}/);
  await p.click('button:has-text("Shortlisted")'); await p.waitForTimeout(800);
  await p.fill('#body', 'Strong FI background, schedule a call.'); await p.click('button:has-text("Add note")'); await p.waitForSelector('text=Strong FI background');
  await shot(p, '09-application-detail');
  const dl = await p.request.get(p.url().replace('/admin/applications/', '/admin/api/resume/'));
  log('resume download', dl.status(), dl.headers()['content-type'], dl.headers()['content-disposition'], (await dl.body()).subarray(0, 8).toString());
  const csv = await p.request.get(B + '/admin/api/applications-export');
  log('csv', csv.status(), (await csv.text()).split('\r\n').length - 1, 'rows');
  await p.goto(B + '/admin/talent'); await shot(p, '10-talent'); log('talent rows', await p.locator('tbody tr').count());
  await p.goto(B + '/admin/enquiries'); await shot(p, '11-enquiries');
  await p.click('tbody tr a >> nth=0'); await p.selectOption('#status', 'contacted'); await p.fill('#notes', 'Called, sending proposal.'); await p.click('button:has-text("Save")'); await p.waitForSelector('text=Saved.');
  await shot(p, '12-enquiry-detail');

  // Users
  await p.goto(B + '/admin/users'); await p.fill('#name', 'View Only'); await p.fill('#email', 'viewer@example.test'); await p.selectOption('#role', 'viewer');
  await p.click('button:has-text("Add user")'); await p.waitForSelector('[role=status]');
  const msg = await p.textContent('[role=status]'); const temp = msg.match(/temporary password (\S+)\./)[1]; log('invited, temp pw len', temp.length);
  await shot(p, '13-users');

  // ---------- Phase 1: openings fields, pipeline, candidate profiles ----------
  await p.goto(B + `/admin/openings/${openingId}`);
  await p.fill('#vacancies', '2'); await p.selectOption('#salary_visible', 'hide'); await p.fill('#min_experience_years', '3');
  await p.click('label.a-chip:has-text("Test Owner")');
  await p.click('button:has-text("Save changes")'); await p.waitForSelector('text=Saved', { timeout: 8000 });
  await shot(p, '20-opening-recruiters');
  await p.goto(B + '/admin/openings'); log('openings list shows recruiter:', (await p.content()).includes('Test Owner'), '2 positions:', await p.locator('text=2 positions').count());
  const jh = await (await p.request.get(jobUrl)).text(); log('job page hides salary:', !jh.includes('18–24'), 'shows positions:', jh.includes('Open positions'));
  // A new application on this job is auto-assigned to the only recruiter
  const api2 = await request.newContext({ baseURL: B, extraHTTPHeaders: { origin: B, host: new URL(B).host, 'x-forwarded-for': '203.0.113.7' } });
  r = await api2.post('/api/careers', { multipart: { openingId, fullName: 'Third Tester', email: 'third@example.test', phone: '+91 60000 00000', position: 'SAP S/4HANA FICO Consultant', experience: '5–8 years', message: '', startedAt: started, website: '', consent: 'yes', resume: { name: 'cv.pdf', mimeType: 'application/pdf', buffer: pdf } } });
  log('apply after recruiter set', r.status());
  // A duplicate profile: different email, same phone as Test Candidate
  r = await api2.post('/api/cv', { multipart: { fullName: 'Test Candidate', email: 'test.alt@example.test', phone: '+91 90000 00000', location: 'Pune', preferredLocation: 'Pune', specialisation: 'SAP ABAP', experience: '5–8 years', employmentType: 'Permanent', consent: 'yes', startedAt: started, website: '', cv: { name: 'cv.pdf', mimeType: 'application/pdf', buffer: pdf } } });
  log('duplicate cv api', r.status());

  // Pipeline
  await p.goto(B + '/admin/pipeline'); await p.waitForSelector('[data-card]');
  log('pipeline cards', await p.locator('[data-card]').count());
  const third = p.locator('[data-card]', { hasText: 'Third Tester' });
  log('third auto-assigned:', await third.locator('[title="Recruiter: Test Owner"]').count());
  await third.locator('select').selectOption('screening');
  await p.waitForSelector('[aria-label^="Screening, 1"]', { timeout: 8000 }); log('moved with menu to Screening');
  await p.waitForLoadState('networkidle'); await p.waitForTimeout(800);
  const second = p.locator('[data-card]', { hasText: 'Second Tester' });
  await p.evaluate(() => { document.addEventListener('dragstart', e => console.log('DRAGSTART', e.target.closest('[data-card]')?.textContent?.slice(0, 25)), true); document.addEventListener('drop', e => console.log('DROP', e.dataTransfer.getData('text/plain')), true); });
  p.on('console', m => m.text().startsWith('D') && log(m.text()));
  log('second box', JSON.stringify(await second.boundingBox()), 'cards in new', await p.locator('[aria-label^="New"] [data-card]').allTextContents());
  await second.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  { const sb = await second.locator('p').first().boundingBox(); const tb = await p.locator('[aria-label^="Shortlisted"]').boundingBox();
    await p.mouse.move(sb.x + 20, sb.y + sb.height / 2); await p.mouse.down(); await p.mouse.move(sb.x + 60, sb.y + 20, { steps: 5 });
    await p.mouse.move(tb.x + tb.width / 2, tb.y + 60, { steps: 12 }); await p.mouse.up(); }
  await p.waitForSelector('[aria-label^="Shortlisted, 2"]', { timeout: 8000 }).then(() => log('dragged to Shortlisted')).catch(() => log('DRAG did not land'));
  await p.waitForTimeout(600); await p.reload(); await p.waitForSelector('[data-card]');
  log('after reload screening:', await p.getAttribute('[aria-label^="Screening"]', 'aria-label'), '| shortlisted:', await p.getAttribute('[aria-label^="Shortlisted"]', 'aria-label'));
  await shot(p, '21-pipeline');
  log('Second Tester now in Shortlisted:', await p.locator('[aria-label^="Shortlisted"] [data-card]', { hasText: 'Second Tester' }).count());

  // Candidates list and filters
  await p.goto(B + '/admin/candidates'); await shot(p, '22-candidates'); log('candidate rows', await p.locator('tbody tr').count());
  await p.goto(B + '/admin/talent?q=second'); log('talent redirect ->', p.url().replace(B, ''), 'rows', await p.locator('tbody tr').count());

  // Candidate profile: edit, quick fields, note, duplicate merge
  await p.goto(B + '/admin/candidates?q=candidate%40example.test'); await p.click('tbody tr a >> nth=0'); await p.waitForURL(/candidates\/[0-9a-f-]{36}/);
  const profUrl = p.url().split('?')[0];
  log('duplicates shown:', await p.locator('text=Same phone number').count());
  await p.click('a:has-text("Edit profile")'); await p.waitForSelector('#p-skills');
  await p.fill('#p-current_title', 'Senior FICO Consultant'); await p.fill('#p-experience_years', '6'); await p.fill('#p-skills', 'SAP FI, SAP CO, S/4HANA');
  await p.fill('#p-tags', 'Bench, Relocation OK'); await p.selectOption('#p-availability', 'Within 30 days'); await p.fill('#p-linkedin_url', 'http://bad.example');
  await p.click('button:has-text("Save profile")'); await p.waitForSelector('p[role=alert]'); log('bad linkedin rejected:', await p.locator('text=Use a https://linkedin.com').count(), 'typed title kept:', await p.inputValue('#p-current_title'));
  await p.fill('#p-linkedin_url', '');
  await p.click('button:has-text("Save profile")'); await p.waitForSelector('text=Profile saved.', { timeout: 8000 }); log('profile saved');
  await p.goto(profUrl);
  await p.selectOption('#q-priority', 'urgent'); await p.waitForSelector('text=Priority saved.', { timeout: 8000 });
  await p.selectOption('#q-owner', { label: 'Test Owner' }); await p.waitForSelector('text=Owner saved.', { timeout: 8000 });
  await p.fill('#q-followup', '2020-01-02'); await p.waitForSelector('text=Follow up on saved.', { timeout: 8000 });
  await p.click('button:has-text("Mark contacted")'); await p.waitForTimeout(800);
  await p.fill('#c-note', 'Spoke today, open to Bengaluru roles.'); await p.click('button:has-text("Add note")'); await p.waitForSelector('li:has-text("Spoke today")');
  await p.reload();
  log('follow-up due shown:', await p.locator('text=Follow-up is due').count(), 'timeline items:', await p.locator('ol li').count());
  await shot(p, '23-candidate-profile');
  await p.click('nav[aria-label="Filter timeline"] a:has-text("Profile")'); await p.waitForURL(/kind=edit/); log('profile-change entries:', await p.locator('ol li').count());
  await p.goto(profUrl);
  await p.click('button:has-text("Merge into this profile")'); await shot(p, '24-merge-dialog');
  await p.click('dialog[open] button:has-text("Merge profiles")'); await p.waitForURL(/merged=1/); log('merged; applications rows now', await p.locator('table.a-table tbody tr').count(), 'dups left:', await p.locator('text=Same phone number').count());
  await p.goto(B + '/admin/candidates?followUp=due'); log('follow-up due filter rows', await p.locator('tbody tr').count());
  await p.goto(B + '/admin/candidates?skill=sap%20fi%2C%20s%2F4hana'); log('skill filter rows', await p.locator('tbody tr').count());

  // Application detail: recruiter assignment
  await p.goto(B + '/admin/applications?q=second'); await p.click('tbody tr a >> nth=0'); await p.waitForURL(/applications\/[0-9a-f-]{36}/);
  await p.selectOption('#assignee', { label: 'Test Owner' }); await p.click('form:has(#assignee) button'); await p.waitForSelector('li:has-text("Assigned to")', { timeout: 8000 });
  log('assignment on history');
  await shot(p, '25-application-assigned');
  await p.goto(B + '/admin/applications?assigned=me'); log('assigned to me rows', await p.locator('tbody tr').count());
  await p.goto(B + '/admin/activity'); log('activity has merge:', await p.locator('text=Merged').count());
  await p.goto(B + '/admin/settings'); await shot(p, '14-settings');
  await p.goto(B + '/admin/activity'); await shot(p, '15-activity');

  // Viewer role
  const v = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await v.goto(B + '/admin/login'); await v.fill('#email', 'viewer@example.test'); await v.fill('#password', temp); await v.click('button[type=submit]');
  await v.waitForURL(/change-password/); log('viewer forced to change password');
  await v.fill('#current', temp); await v.fill('#password', 'blue-river-4821'); await v.fill('#confirm', 'blue-river-4821'); await v.click('button[type=submit]'); await v.waitForURL(/\/admin\?password/);
  const navText = await v.textContent('aside nav'); log('viewer nav:', navText);
  await v.goto(B + '/admin/users'); log('viewer /users ->', v.url());
  await v.goto(B + '/admin/applications'); log('viewer sees download link:', await v.locator('text=Download').count(), 'client filter:', await v.locator('#client').count());
  const vdl = await v.request.get(B + '/admin/api/applications-export'); log('viewer export', vdl.status());
  await v.goto(B + `/admin/openings/${openingId}`); log('viewer sees client:', (await v.content()).includes('Example Client'));


  await v.goto(B + '/admin/pipeline'); log('viewer pipeline move menus:', await v.locator('[data-card] select').count(), 'cards:', await v.locator('[data-card]').count());
  await v.goto(profUrl); log('viewer profile edit controls:', await v.locator('text=Edit profile').count() + await v.locator('#q-priority').count() + await v.locator('text=Merge into').count());
  const vr = await v.request.post(profUrl, { headers: { 'next-action': 'x' } }); log('viewer forged action status', vr.status());

  // Dark + mobile
  const d = await (await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', storageState: await ctx.storageState() })).newPage();
  await d.goto(B + '/admin'); await d.waitForTimeout(400); await shot(d, '16-dashboard-dark');
  await d.goto(B + '/admin/applications'); await shot(d, '17-applications-dark');
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, storageState: await ctx.storageState() })).newPage();
  await m.goto(B + '/admin'); await shot(m, '18-dashboard-mobile');
  await m.goto(profUrl); await shot(m, '26-profile-mobile'); log('profile mobile overflow', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  await m.goto(B + '/admin/pipeline'); await shot(m, '27-pipeline-mobile'); log('pipeline mobile page overflow', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  await d.goto(profUrl); await shot(d, '28-profile-dark'); await d.goto(B + '/admin/pipeline'); await shot(d, '29-pipeline-dark');
  log('mobile overflow', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth));

  // Pause hides from site; sign out
  await p.goto(B + `/admin/openings/${openingId}`); await p.click('button:has-text("Pause")'); await p.waitForTimeout(800);
  const jr = await p.request.get(jobUrl); log('paused job page status', jr.status());
  await p.goto(B + '/admin'); await p.click('summary'); await p.click('button:has-text("Sign out")'); await p.waitForURL(/login/); log('signed out');
  log('errors:', errs.join(' | ') || 'none');
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
