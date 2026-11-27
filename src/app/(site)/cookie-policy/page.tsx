import { LegalPage } from "@/components/sections/LegalPage";
import { site } from "@/content/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Cookie Policy",
  description: "How the VMR Cloud Solutions website uses cookies and similar technologies.",
  path: "/cookie-policy",
});

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Cookie Policy" updated="11 November 2026" intro="How this website uses cookies and similar technologies.">
      <h2>1. What are cookies?</h2>
      <p>Cookies are small text files that a website stores on your device. They are widely used to make websites work and to provide information to site owners.</p>

      <h2>2. How we use cookies</h2>
      <p>
        This website does not set advertising or tracking cookies. We only use what is strictly necessary for the website to function securely. The embedded Google Map on our contact page is provided by Google and may set its own cookies when it loads; see Google&apos;s privacy policy for details.
      </p>

      <h2>3. Analytics</h2>
      <p>If we introduce website analytics in the future, we will update this policy to describe the cookies used and, where required, ask for your consent.</p>

      <h2>4. Managing cookies</h2>
      <p>You can block or delete cookies through your browser settings. Blocking strictly necessary cookies may affect how parts of the website work.</p>

      <h2>5. Contact</h2>
      <p>
        If you have any questions about this policy, email <a href={`mailto:${site.email.general}`}>{site.email.general}</a>.
      </p>
    </LegalPage>
  );
}
