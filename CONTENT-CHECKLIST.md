# Content to confirm before launch

The site only uses information from the brief and the documents VMR supplied. These items are marked `CONFIRM` in the code and should be checked with management.

## Company facts
- [ ] Team size "~100" (homepage highlights) – management estimate. The 2018 Shops & Establishments certificate listed 13 employees.
- [ ] CIN `U72200KA2017PTC106210` – check against MCA records. (GSTIN and Udyam number match the supplied certificates.)
- [ ] Shops & Establishments registration (29/53/S/0133/2018) was valid to 31-12-2022 – confirm renewal.
- [ ] ISO 9001:2015 – the logos were supplied, but no certificate copy. Confirm the certificate is current and the certifying body (IAC / UASL) is correct.
- [ ] Mission, vision, values and the "Our journey" timeline wording.

- [ ] Andhra Pradesh branch (1-151/1, 2nd Floor, Near Kotapalli, Pileru, Chittoor – 517294; GSTIN 37AAGCV0903J1ZB) – taken from a company invoice; confirm it should be public.

## Services and expertise
- [ ] Final list of 8 services and the capability areas under each.
- [ ] SAP products listed on the SAP page: S/4HANA, ABAP, Fiori, BTP, Basis.
- [ ] Java / Python frameworks to name (none named yet, e.g. Spring Boot).
- [ ] Cloud platforms (AWS / Azure / Google Cloud are deliberately not mentioned).
- [ ] Which IT staffing models to list. Contract staffing is confirmed (company invoice); confirm augmentation and recruitment.
- [ ] Whether "managed services" / SLAs are offered (the site says "Application Support").
- [ ] AI / machine learning – not listed as a service.

## Industries and clients
- [ ] The 7 industries on the Industries page – keep only sectors with real experience.
- [ ] Permission to display the 8 client logos (Viraj Profiles, Simelabs, Atos Syntel, Espouse Technology, NeoSOFT, Altimetrik, Khatib & Alami, Protiviti). Edit `src/content/clients.ts` to add or remove.
- [ ] Testimonials / case studies (none on the site yet).

## Not added yet (waiting for information)
- [ ] Leadership section – names, designations, photos, bios. (GST records list Fatima Bee Kalamadugu and Vannilli Mahammadshafi as managing directors; the brief mentions Mahammad Rafi, Head of IT Projects. Not published until confirmed.)
- [ ] Real team / office photographs.
- [ ] Social media URLs (`src/content/site.ts → social`).
- [ ] International markets (India / Australia / Saudi Arabia) – not mentioned anywhere.
- [ ] Current job openings (careers page invites general applications).
- [ ] Analytics (e.g. Google Analytics) – add only with an updated cookie policy.

## SAP recruitment (added November 2026)
- [ ] Market wording "UK & Europe" – the site doesn't claim a UK office. Add a UK address if one exists.
- [ ] Recruitment service highlights (e.g. "established international contractor pool", "support through to offer").
- [ ] Candidate promises on /upload-cv: "we never send your CV to an employer without speaking to you first" and deletion on request.
- [ ] Privacy Policy section 5 (candidates / UK GDPR) and the 12-month retention period – legal review.
- [ ] Permission from each of the 8 clients to display their logo on the Our Clients page.

## Launch setup
- [ ] Private Vercel Blob store connected to the project (for Upload Your CV).
- [ ] SMTP credentials for the forms (see `.env.example`).
- [ ] Domain and hosting access for vmrcloudsolutions.com.
- [ ] Legal review of Privacy Policy, Terms and Cookie Policy (written as sensible templates under Indian law).
