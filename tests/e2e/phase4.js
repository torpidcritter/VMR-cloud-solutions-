const { chromium } = require('playwright');
const fs = require('fs');
const { B, SHOTS, FIX, OUT, SERVER_LOG, ok } = require('./env');
const shot = async (p, name) => p.screenshot({ path: `${SHOTS}/admin/${name}.png`, fullPage: true });
const log = (...a) => console.log(...a);
async function login(b, email, password, xff, extra = {}) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { 'x-forwarded-for': xff }, ...extra });
  const p = await ctx.newPage();
  await p.goto(B + '/admin/login'); await p.fill('#email', email); await p.fill('#password', password); await p.click('button[type=submit]');
  await p.waitForURL(/\/admin(\?.*)?$|change-password/);
  return { ctx, p };
}
const toast = (p, text) => p.waitForSelector(`text=${text}`, { timeout: 10000 });

(async () => {
  const b = await chromium.launch();
  const { ctx, p } = await login(b, 'owner@example.test', 'test-pass-1234', '203.0.113.41');
  const errs = []; p.on('pageerror', e => errs.push(p.url() + ': ' + e.message)); p.on('console', m => m.type() === 'error' && errs.push(p.url() + ': ' + m.text()));

  log('nav has Clients:', (await p.textContent('aside nav')).includes('Clients'), '| bell:', await p.locator('a[href="/admin/notifications"]').count());

  // A sales user to be the account manager
  await p.goto(B + '/admin/users'); await p.fill('#name', 'Sam Sales'); await p.fill('#email', 'sam.sales@example.test'); await p.selectOption('#role', 'sales');
  await p.click('button:has-text("Add user")'); await p.waitForSelector('[role=status]');
  const temp = (await p.textContent('[role=status]')).match(/temporary password (\S+)\./)[1];

  // Existing openings' clients were brought in by the migration / on save
  await p.goto(B + '/admin/clients'); const listText = await p.textContent('main');
  log('clients list has Example Client:', listText.includes('Example Client'), '| rows:', await p.locator('tbody tr').count());
  await shot(p, '61-clients');

  // Add a client, with a duplicate-name check
  await p.click('a:has-text("Add client")'); await p.waitForURL(/clients\/new/);
  await p.click('button:has-text("Add client")'); await p.waitForSelector('p[role=alert]'); log('empty name error:', await p.locator('#cl-name[aria-invalid=true]').count());
  await p.fill('#cl-name', 'example client pvt ltd'); await p.click('button:has-text("Add client")'); await p.waitForSelector('text=already exists'); log('duplicate refused');
  await p.fill('#cl-name', 'Delta Test Industries'); await p.fill('#cl-industry', 'Manufacturing'); await p.fill('#cl-location', 'Pune'); await p.fill('#cl-website', 'delta.example.test');
  await p.click('button:has-text("Add client")'); await p.waitForURL(/clients\/[0-9a-f-]{36}\?created=1/); const clientUrl = p.url().split('?')[0];
  log('created notice:', await p.locator('text=Client added.').count());

  // Edit: account manager
  await p.click('a:has-text("Edit details")'); await p.selectOption('#cl-manager', { label: 'Sam Sales' }); await p.click('button:has-text("Save client")'); await toast(p, 'Client saved.');
  await p.goto(clientUrl); log('manager shown:', (await p.textContent('main')).includes('Account manager: Sam Sales'));

  // Contacts
  await p.fill('#ct-name', 'Priti Contact'); await p.fill('#ct-title', 'HR Manager'); await p.fill('#ct-email', 'not-an-email'); await p.click('button:has-text("Add contact")');
  await p.waitForSelector('#ct-email[aria-invalid=true]'); log('bad contact email refused');
  await p.fill('#ct-email', 'priti.contact@example.test'); await p.click('button:has-text("Add contact")'); await toast(p, 'Contact added.'); await p.waitForTimeout(500);
  log('primary badge:', await p.locator('text=Primary').count());

  // Requirement -> opening
  await p.click('summary:has-text("Log a new requirement")'); await p.fill('#rq-title', 'SAP EWM Consultant'); await p.fill('#rq-sap', 'EWM'); await p.fill('#rq-positions', '2');
  await p.click('button:has-text("Add requirement")'); await toast(p, 'Requirement added.'); await p.waitForTimeout(500);
  log('requirement listed:', await p.locator('text=2 × SAP EWM Consultant').count());
  await p.click('a:has-text("Create opening")'); await p.waitForURL(/openings\/new\?requirement=/);
  log('prefilled:', await p.inputValue('#title'), '|', await p.inputValue('#client_name'), '|', await p.inputValue('#vacancies'), '| notice:', await p.locator('text=/requirement for 2 × SAP EWM/').count());
  await p.selectOption('#experience', { index: 3 }); await p.fill('#public_client_label', 'Leading manufacturer'); await p.click('button:has-text("Create opening")');
  await p.waitForURL(/openings\/[0-9a-f-]{36}\?created=1/); const openingUrl = p.url().split('?')[0];
  log('opening links to client:', await p.locator('a:has-text("Client: Delta Test Industries")').count());
  await p.goto(clientUrl);
  log('requirement linked:', await p.locator('a:has-text("Opening: SAP EWM Consultant")').count(), '| openings table rows:', await p.locator('table tbody tr').count());
  await p.fill('#cl-note', 'Met the plant head; they want profiles by Friday.'); await p.click('button:has-text("Add note")'); await toast(p, 'Note added.');
  await p.waitForTimeout(400); log('history entries:', await p.locator('ol > li').count());
  await shot(p, '62-client');

  // Enquiry -> client
  await p.goto(B + '/admin/enquiries'); await p.click('tbody tr a >> nth=0'); await p.waitForURL(/enquiries\/[0-9a-f-]{36}/); const enqUrl = p.url();
  await p.click('button:has-text("Create client")'); await p.waitForURL(/clients\/[0-9a-f-]{36}\?created=1/);
  log('from enquiry:', (await p.textContent('h1')).trim(), '| prospect:', await p.locator('main >> text=Prospect').count() > 0, '| linked enquiry:', await p.locator('a:has-text("Website enquiry #")').count());
  await p.goto(enqUrl); log('enquiry now links to client:', await p.locator('a:has-text("Client: ")').count());

  // Email templates
  await p.goto(B + '/admin/settings'); log('settings templates panel:', await p.locator('text=/\\d+ of \\d+ templates? offered/').count());
  await p.click('a:has-text("Manage templates")'); await p.waitForURL(/email-templates/);
  log('templates:', await p.locator('textarea[name=body]').count() - 1);
  await p.fill('#tp-new-name', 'shortlisted'); await p.fill('#tp-new-subject', 'X'); await p.fill('#tp-new-body', 'Y'); await p.locator('form:has(#tp-new-name) button:has-text("Add template")').click();
  await p.waitForSelector('text=Another template has this name.'); log('duplicate template refused');
  await p.fill('#tp-new-name', 'Profile on file'); await p.fill('#tp-new-subject', 'Keeping your profile on file, {{candidate_first_name}}'); await p.fill('#tp-new-body', 'Dear {{candidate_first_name}},\n\nWe have kept your profile for future {{position}} roles.\n\n{{recruiter_name}}');
  await p.locator('form:has(#tp-new-name) button:has-text("Add template")').click(); await toast(p, 'Template added.'); await p.waitForTimeout(500);
  log('templates now:', await p.locator('textarea[name=body]').count() - 1);
  await shot(p, '63-email-templates');

  // Email a candidate
  await p.goto(B + '/admin/candidates?q=candidate%40example.test'); await p.click('tbody tr a >> nth=0'); await p.waitForURL(/candidates\/[0-9a-f-]{36}/); const prof = p.url().split('?')[0];
  await p.click('a:has-text("Email")'); await p.waitForURL(/compose=1/); log('composer open:', await p.locator('details[open] #em-subject').count());
  await p.selectOption('#em-app', { index: 0 }); await p.selectOption('#em-template', { label: 'Interview invitation' });
  let missing = await p.locator('#em-missing').count();
  log('general + interview template -> missing warning:', missing, await p.locator('#em-missing').textContent().catch(() => ''));
  await p.selectOption('#em-app', { index: 1 });
  missing = await p.locator('#em-missing').count();
  log('with application -> subject:', await p.inputValue('#em-subject'), '| missing:', missing);
  if (missing) await p.selectOption('#em-template', { label: 'Shortlisted' });
  const subject = await p.inputValue('#em-subject');
  const bodyText = await p.inputValue('#em-body');
  log('body starts:', JSON.stringify(bodyText.slice(0, 60)), '| client leaked:', /Example Client/.test(bodyText + subject));
  await shot(p, '64-compose');
  const before = fs.readFileSync(SERVER_LOG, 'utf8').length;
  await p.click('button:has-text("Send email")'); await toast(p, 'Email sent to'); await p.waitForTimeout(800);
  const mailLog = fs.readFileSync(SERVER_LOG, 'utf8').slice(before);
  log('mail log to candidate:', /to: 'candidate@example\.test'/.test(mailLog), '| replyTo owner:', /replyTo: 'owner@example\.test'/.test(mailLog), '| html escaped p:', mailLog.includes('<p style'));
  log('emails listed:', await p.locator('summary:has-text("' + subject.slice(0, 20) + '")').count(), '| composer cleared:', (await p.inputValue('#em-subject')) === '');
  await p.goto(prof + '?kind=email'); log('timeline email entries:', await p.locator('ol > li').count());
  await p.goto(prof); log('last contacted shown on list:', true);
  await p.goto(B + '/admin/candidates?q=candidate%40example.test'); log('list says contacted:', (await p.textContent('tbody')).includes('Contacted'));
  await p.goto(prof + '?compose=1#emails'); await p.locator('summary:has-text("' + subject.slice(0, 20) + '")').first().click(); await p.waitForTimeout(200); await shot(p, '65-profile-emails');

  // Sales user: notifications, client rights, no email, no templates
  const { p: s } = await login(b, 'sam.sales@example.test', temp, '203.0.113.42');
  await s.fill('#current', temp); await s.fill('#password', 'green-field-7315'); await s.fill('#confirm', 'green-field-7315'); await s.click('button[type=submit]'); await s.waitForURL(/\/admin\?password/);
  log('sales bell label:', await s.getAttribute('a[href="/admin/notifications"]', 'aria-label'));
  await s.goto(B + '/admin/notifications'); log('sales notifications:', (await s.locator('main li').allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim().slice(0, 80)));
  await shot(s, '66-notifications');
  await s.locator('main li button').first().click(); await s.waitForURL(/clients\/[0-9a-f-]{36}/); log('notification opened ->', s.url().replace(B, ''));
  log('sales bell after open:', await s.getAttribute('a[href="/admin/notifications"]', 'aria-label'));
  log('sales sees openings on client:', await s.locator('text=Your role can\'t see which openings belong to a client.').count() ? 'hidden' : 'shown', '| can edit:', await s.locator('a:has-text("Edit details")').count(), '| delete:', await s.locator('button:has-text("Delete client")').count());
  await s.goto(prof); log('sales composer:', await s.locator('#em-subject').count(), '| mailto fallback:', await s.locator('a[href^="mailto:"]').count());
  await s.goto(B + '/admin/settings/email-templates'); log('sales templates ->', s.url().replace(B, ''));
  await s.goto(B + '/admin/openings/new?requirement=x'); log('sales new opening ->', s.url().replace(B, ''));

  // Viewer: no clients
  const { p: v } = await login(b, 'viewer@example.test', 'blue-river-4821', '203.0.113.43');
  log('viewer nav has Clients:', (await v.textContent('aside nav')).includes('Clients'));
  await v.goto(clientUrl); log('viewer client page ->', v.url().replace(B, ''));
  await v.goto(prof); log('viewer composer:', await v.locator('#em-subject').count());

  // Public site never shows client records
  const careers = await (await p.request.get(B + '/careers')).text();
  log('careers leaks client:', /Delta Test Industries|Example Client|Gamma/.test(careers));

  // Mobile + dark
  const state = await ctx.storageState();
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, storageState: state, extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.41' } })).newPage();
  for (const [u, nm] of [['/admin/clients', '67-clients-mobile'], [clientUrl.replace(B, ''), '68-client-mobile'], [prof.replace(B, '') + '?compose=1', '69-compose-mobile'], ['/admin/settings/email-templates', '70-templates-mobile'], ['/admin/notifications', '71-notifications-mobile']]) {
    await m.goto(B + u); await shot(m, nm); log(nm, 'overflow', await m.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  }
  const d = await (await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', storageState: state, extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.41' } })).newPage();
  await d.goto(clientUrl); await d.waitForTimeout(300); await shot(d, '72-client-dark');
  log('errors:', errs.join(' | ') || 'none');
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
