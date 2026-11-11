import { LegalPage } from "@/components/sections/LegalPage";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How VMR Cloud Solutions Private Limited collects, uses and protects personal information submitted through this website.",
  path: "/privacy-policy",
});

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="11 November 2026"
      intro="How we collect, use and protect the personal information you share with us through this website."
    >
      <h2>1. Who we are</h2>
      <p>
        This website is operated by {site.legalName} (&quot;VMR&quot;, &quot;we&quot;, &quot;us&quot;), a company incorporated in India with its registered office at{" "}
        {site.address.lines.join(", ")}.
      </p>

      <h2>2. Information we collect</h2>
      <p>We collect only the information you choose to give us, and limited technical information needed to run the website securely.</p>
      <ul>
        <li>
          <strong>Business enquiries:</strong> your name, company name, business email, contact number, the service you are interested in and your message.
        </li>
        <li>
          <strong>Job applications:</strong> your full name, email address, phone number, the position applied for, years of experience, your resume and any message you include.
        </li>
        <li>
          <strong>CV submissions (Upload Your CV):</strong> your full name, email address, phone number, current location, SAP specialisation, years of experience, preferred employment type, your CV and a record of your consent.
        </li>
        <li>
          <strong>Technical information:</strong> standard server logs such as IP address, browser type and the pages requested, used for security and to prevent misuse.
        </li>
      </ul>

      <h2>3. How we use your information</h2>
      <ul>
        <li>To respond to your enquiry and discuss your requirements.</li>
        <li>To assess job applications and CV submissions, and contact candidates about SAP and technology opportunities.</li>
        <li>To keep the website secure, including protecting forms against spam and abuse.</li>
        <li>To comply with applicable legal obligations.</li>
      </ul>
      <p>We do not sell your personal information, and we do not use it for unrelated marketing without your consent.</p>

      <h2>4. Legal basis and consent</h2>
      <p>
        We process personal data in accordance with applicable Indian law, including the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023. By submitting a form, you consent to us using the information provided for the purposes described above. You may withdraw your consent at any time by contacting us.
      </p>

      <h2 id="candidates">5. Candidates and CV submissions</h2>
      <p>
        When you upload your CV, we use your information to assess your suitability for contract and permanent SAP roles, to contact you about opportunities and to keep a record of your consent. Because we recruit for organisations in the United Kingdom and Europe, we handle candidate data in line with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018, as well as applicable Indian law.
      </p>
      <ul>
        <li>
          <strong>Legal basis:</strong> your consent, which you give when you submit the form. You can withdraw it at any time by emailing <a href={`mailto:${site.email.hr}`}>{site.email.hr}</a>.
        </li>
        <li>
          <strong>Storage:</strong> CVs are kept in private, access-controlled cloud storage that is not reachable from the public website, and are sent to our recruitment team by email.
        </li>
        <li>
          <strong>Sharing:</strong> we will not send your CV or details to a prospective employer or client without first discussing the role with you.
        </li>
        <li>
          <strong>Your rights:</strong> you can ask for a copy of your data, ask us to correct or delete it, object to or restrict its use, and ask for it in a portable format. If you are in the UK, you can also complain to the Information Commissioner&apos;s Office (ico.org.uk).
        </li>
        <li>
          <strong>International transfers:</strong> our team is based in India and our service providers may store data in other countries. Where data leaves the UK or EEA, we rely on appropriate safeguards required by law.
        </li>
      </ul>

      <h2>6. Sharing your information</h2>
      <p>
        Your information is shared only with VMR personnel who need it to respond to you, and with service providers who help us operate the website and email (for example, hosting and email delivery). These providers may only use the information to provide their services to us.
      </p>

      <h2>7. How long we keep it</h2>
      <p>
        We keep enquiry information for as long as needed to respond and maintain our business relationship. We keep job applications and CV submissions for up to 12 months so we can consider you for future roles, unless you ask us to delete them sooner.
      </p>

      <h2>8. Security</h2>
      <p>The website is served over HTTPS and we take reasonable technical and organisational measures to protect personal information. No online transmission is completely secure, however.</p>

      <h2>9. Your rights</h2>
      <p>You may ask us to access, correct, update or erase the personal information we hold about you, or raise a grievance about how it has been handled.</p>

      <h2>10. Contact and grievances</h2>
      <p>
        For any privacy question or request, please email <a href={`mailto:${site.email.general}`}>{site.email.general}</a> or write to us at our registered office address above.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>We may update this policy from time to time. The latest version will always be available on this page.</p>
    </LegalPage>
  );
}
