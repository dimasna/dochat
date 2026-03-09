import Link from "next/link";

export const metadata = {
  title: "Terms of Service - Dochat",
  description: "Dochat terms of service — rules and guidelines for using our platform",
};

export default function TermsOfServicePage() {
  return (
    <div className="max-w-[800px] mx-auto px-6 py-20 prose-docs">
      <h1>Terms of Service</h1>
      <p>Last updated: March 2025</p>
      <p>
        These Terms of Service ("Terms") govern your use of the Dochat platform
        ("Service") operated by Dochat ("we", "us", "our"). By using the Service, you
        agree to these Terms.
      </p>

      <h2>1. Account Registration</h2>
      <p>
        To use Dochat, you must create an account and provide accurate information. You
        are responsible for maintaining the security of your account and all activity
        under it.
      </p>
      <ul>
        <li>You must be at least 16 years old to use the Service</li>
        <li>You must provide a valid email address</li>
        <li>You are responsible for keeping your credentials secure</li>
        <li>You must notify us immediately of any unauthorized access</li>
      </ul>

      <h2>2. Acceptable Use</h2>
      <p>You agree not to use Dochat to:</p>
      <ul>
        <li>Violate any applicable laws or regulations</li>
        <li>Infringe on the intellectual property rights of others</li>
        <li>Distribute malware, spam, or harmful content</li>
        <li>Attempt to gain unauthorized access to our systems</li>
        <li>Impersonate another person or entity</li>
        <li>Harass, abuse, or threaten others</li>
        <li>Upload illegal, defamatory, or obscene content to knowledge bases</li>
      </ul>
      <p>
        We reserve the right to suspend or terminate accounts that violate these terms.
      </p>

      <h2>3. Your Content</h2>
      <p>
        You retain ownership of all content you upload to Dochat, including knowledge
        base documents, agent configurations, and conversation data.
      </p>
      <p>
        By uploading content, you grant us a limited license to process, store, and
        index that content solely to provide the Service to you. We do not claim
        ownership of your content.
      </p>
      <p>
        You are responsible for ensuring you have the right to upload and use any
        content you add to the platform.
      </p>

      <h2>4. AI-Generated Responses</h2>
      <p>
        Dochat uses artificial intelligence to generate responses to your customers.
        While we strive for accuracy:
      </p>
      <ul>
        <li>AI responses are generated based on your knowledge base content</li>
        <li>We do not guarantee the accuracy, completeness, or suitability of AI responses</li>
        <li>You are responsible for reviewing and monitoring your agent's responses</li>
        <li>You should configure escalation rules for sensitive topics</li>
      </ul>

      <h2>5. Service Availability</h2>
      <p>
        We aim to provide reliable, uninterrupted service but do not guarantee 100%
        uptime. We may temporarily suspend the Service for maintenance, updates, or
        unforeseen circumstances.
      </p>
      <p>
        We will make reasonable efforts to notify you in advance of planned downtime.
      </p>

      <h2>6. Pricing and Payment</h2>
      <p>
        Dochat offers free and paid plans. Paid plans are billed monthly or annually as
        selected. By subscribing to a paid plan:
      </p>
      <ul>
        <li>You authorize us to charge your payment method on a recurring basis</li>
        <li>You can cancel at any time — access continues until the end of the billing period</li>
        <li>Refunds are handled on a case-by-case basis</li>
        <li>We may change pricing with 30 days' notice</li>
      </ul>

      <h2>7. Plan Limits</h2>
      <p>
        Each plan has limits on agents, knowledge bases, conversations, and storage. If
        you exceed your plan limits, you may need to upgrade or reduce usage. We will
        notify you before restricting functionality.
      </p>

      <h2>8. Data and Privacy</h2>
      <p>
        Your use of the Service is also governed by our{" "}
        <Link href="/privacy">Privacy Policy</Link>. By using Dochat, you consent to
        the data practices described in the Privacy Policy.
      </p>

      <h2>9. Intellectual Property</h2>
      <p>
        The Dochat platform, including its code, design, and branding, is owned by us
        and protected by intellectual property laws. These Terms do not grant you any
        right to use our trademarks, logos, or brand assets without permission.
      </p>

      <h2>10. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, Dochat shall not be liable for any
        indirect, incidental, special, consequential, or punitive damages arising from
        your use of the Service, including but not limited to:
      </p>
      <ul>
        <li>Loss of revenue, data, or business opportunities</li>
        <li>Errors or inaccuracies in AI-generated content</li>
        <li>Service interruptions or downtime</li>
        <li>Unauthorized access to your account</li>
      </ul>

      <h2>11. Indemnification</h2>
      <p>
        You agree to indemnify and hold Dochat harmless from any claims, damages, or
        expenses arising from your use of the Service, your content, or your violation
        of these Terms.
      </p>

      <h2>12. Termination</h2>
      <p>
        You may close your account at any time. We may suspend or terminate your
        account if you violate these Terms or engage in activity that harms the Service
        or other users.
      </p>
      <p>
        Upon termination, your data will be deleted within 30 days, except where
        required by law.
      </p>

      <h2>13. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. We will notify you of material
        changes by email or through the platform. Continued use of the Service after
        changes take effect constitutes acceptance.
      </p>

      <h2>14. Governing Law</h2>
      <p>
        These Terms are governed by applicable law. Any disputes will be resolved
        through good-faith negotiation first, and if necessary, through binding
        arbitration.
      </p>

      <h2>15. Contact</h2>
      <p>
        Questions about these Terms? Contact us at{" "}
        <a href="mailto:legal@dochat.site">legal@dochat.site</a>.
      </p>

      <div className="mt-12 pt-6 border-t border-border">
        <Link href="/" className="text-sm text-primary hover:underline">
          &larr; Back to Home
        </Link>
      </div>
    </div>
  );
}
