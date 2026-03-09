import Link from "next/link";

export const metadata = {
  title: "Privacy Policy - Dochat",
  description: "Dochat privacy policy — how we collect, use, and protect your data",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-[800px] mx-auto px-6 py-20 prose-docs">
      <h1>Privacy Policy</h1>
      <p>Last updated: March 2025</p>
      <p>
        This Privacy Policy describes how Dochat ("we", "us", "our") collects, uses,
        and protects your information when you use our platform at dochat.site and
        related services.
      </p>

      <h2>1. Information We Collect</h2>

      <h3>Account Information</h3>
      <p>When you create an account, we collect:</p>
      <ul>
        <li>Name and email address</li>
        <li>Organization name</li>
        <li>Authentication credentials (managed by Clerk)</li>
      </ul>

      <h3>Knowledge Base Content</h3>
      <p>
        When you upload documents, crawl websites, or add text sources, we store this
        content to train your AI agents. This data belongs to you and is only used to
        power your agents.
      </p>

      <h3>Conversation Data</h3>
      <p>
        We store messages exchanged between your customers and your AI agents, including:
      </p>
      <ul>
        <li>Message content and timestamps</li>
        <li>Conversation status and metadata</li>
        <li>Customer-provided name and email</li>
      </ul>

      <h3>Widget Visitor Data</h3>
      <p>
        When visitors interact with the chat widget, we may collect:
      </p>
      <ul>
        <li>Browser type and language</li>
        <li>Timezone and screen resolution</li>
        <li>Referring page URL</li>
      </ul>
      <p>This information helps identify visitors and provide relevant support.</p>

      <h3>Usage Data</h3>
      <p>We collect anonymized usage data to improve our service, including page views, feature usage, and error logs.</p>

      <h2>2. How We Use Your Information</h2>
      <p>We use your information to:</p>
      <ul>
        <li>Provide, maintain, and improve the Dochat platform</li>
        <li>Train and operate your AI agents using your knowledge base content</li>
        <li>Deliver conversations between your customers and agents</li>
        <li>Send account-related notifications</li>
        <li>Provide customer support</li>
        <li>Detect and prevent fraud or abuse</li>
      </ul>

      <h2>3. What We Don't Do</h2>
      <ul>
        <li>We <strong>do not</strong> sell your data to third parties</li>
        <li>We <strong>do not</strong> use your knowledge base content or conversations to train our own AI models</li>
        <li>We <strong>do not</strong> share your data with advertisers</li>
      </ul>

      <h2>4. Data Storage and Security</h2>
      <p>
        Your data is stored on secure servers hosted by DigitalOcean. We use
        industry-standard security measures including:
      </p>
      <ul>
        <li>Encrypted connections (TLS/SSL)</li>
        <li>Encrypted database storage</li>
        <li>Access controls and authentication</li>
        <li>Regular security audits</li>
      </ul>

      <h2>5. Third-Party Services</h2>
      <p>We use the following third-party services:</p>
      <ul>
        <li><strong>Clerk</strong> — authentication and user management</li>
        <li><strong>DigitalOcean</strong> — hosting, AI infrastructure, and file storage</li>
        <li><strong>DodoPayments</strong> — payment processing</li>
      </ul>
      <p>Each service has its own privacy policy governing how they handle your data.</p>

      <h2>6. Data Retention</h2>
      <p>
        We retain your data for as long as your account is active. When you delete your
        account, we remove your data within 30 days, except where required by law.
      </p>
      <p>You can request deletion of specific data at any time by contacting us.</p>

      <h2>7. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you</li>
        <li>Request correction of inaccurate data</li>
        <li>Request deletion of your data</li>
        <li>Export your data in a portable format</li>
        <li>Withdraw consent where applicable</li>
      </ul>

      <h2>8. Cookies</h2>
      <p>
        We use essential cookies to maintain your session and preferences. The chat
        widget uses local storage to persist visitor sessions across page loads. We do
        not use tracking or advertising cookies.
      </p>

      <h2>9. Children's Privacy</h2>
      <p>
        Dochat is not intended for use by individuals under 16 years of age. We do not
        knowingly collect data from children.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of
        significant changes by email or through the platform. Continued use of the
        service after changes constitutes acceptance.
      </p>

      <h2>11. Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy or your data, contact us at{" "}
        <a href="mailto:privacy@dochat.site">privacy@dochat.site</a>.
      </p>

      <div className="mt-12 pt-6 border-t border-border">
        <Link href="/" className="text-sm text-primary hover:underline">
          &larr; Back to Home
        </Link>
      </div>
    </div>
  );
}
