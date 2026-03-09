import Script from "next/script";
import { Navbar } from "../components/navbar";
import { Footer } from "../components/footer";

const widgetUrl = process.env.NEXT_PUBLIC_WIDGET_URL;
const widgetOrgId = process.env.NEXT_PUBLIC_LANDING_WIDGET_ORG_ID;
const widgetAgentId = process.env.NEXT_PUBLIC_LANDING_WIDGET_AGENT_ID;

export const MarketingLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased">
      <div>
        <Navbar />
        <main>{children}</main>
        <Footer />
      </div>

      {widgetUrl && widgetOrgId && widgetAgentId && (
        <Script
          src={`${widgetUrl}/widget.js`}
          data-organization-id={widgetOrgId}
          data-agent-id={widgetAgentId}
          strategy="afterInteractive"
        />
      )}
    </div>
  );
};
