import { LegalPage } from "@/components/sections/LegalPage";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Terms & Conditions",
  description: "Terms and conditions for using the VMR Cloud Solutions website.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" updated="11 November 2026" intro="The terms that apply when you use this website.">
      <h2>1. About these terms</h2>
      <p>
        This website is owned and operated by {site.legalName}. By accessing or using the website you agree to these terms. If you do not agree, please do not use the website.
      </p>

      <h2>2. Information on this website</h2>
      <p>
        The content on this website is provided for general information about our company and services. It does not constitute an offer, a binding commitment or professional advice. Specific services are provided only under a separate written agreement.
      </p>

      <h2>3. Intellectual property</h2>
      <p>
        The VMR Cloud name and logo, and the text, graphics and design of this website, belong to {site.legalName} unless stated otherwise. Client names and logos are the property of their respective owners and are shown for identification only. You may not reproduce or reuse content from this website without our written permission.
      </p>

      <h2>4. Acceptable use</h2>
      <ul>
        <li>Do not use the website for any unlawful purpose.</li>
        <li>Do not attempt to gain unauthorised access to the website or its systems.</li>
        <li>Do not submit false information, malicious files or spam through our forms.</li>
      </ul>

      <h2>5. Third-party links</h2>
      <p>The website may link to third-party websites such as maps. We are not responsible for the content or practices of those websites.</p>

      <h2>6. Limitation of liability</h2>
      <p>
        We make reasonable efforts to keep the website accurate and available, but we do not guarantee that it will be error-free or uninterrupted. To the extent permitted by law, we are not liable for any loss arising from the use of, or reliance on, this website.
      </p>

      <h2>7. Governing law</h2>
      <p>These terms are governed by the laws of India. The courts at Bengaluru, Karnataka shall have exclusive jurisdiction.</p>

      <h2>8. Contact</h2>
      <p>
        Questions about these terms can be sent to <a href={`mailto:${site.email.general}`}>{site.email.general}</a>.
      </p>
    </LegalPage>
  );
}
