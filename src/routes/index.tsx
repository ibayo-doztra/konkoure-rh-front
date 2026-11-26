import { createFileRoute } from "@tanstack/react-router";
import i18n from "@/lib/i18n";
import { SplashScreen } from "@/components/SplashScreen";
import { useLandingSessionGuard } from "@/hooks/useLandingSessionGuard";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { HeroSection } from "@/components/landing/HeroSection";
import { TrustBandSection } from "@/components/landing/TrustBandSection";
import { BenefitsSection } from "@/components/landing/BenefitsSection";
import { ModulesSection } from "@/components/landing/ModulesSection";
import { GeoAttendanceSection } from "@/components/landing/GeoAttendanceSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { FinalCtaSection } from "@/components/landing/FinalCtaSection";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SITE_URL } from "@/lib/site";

const OG_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/600a8f94-911e-4d96-98b7-874f07a863a6/id-preview-092e2d82--6327e517-24e0-4247-892c-b1564311a161.lovable.app-1777975742816.png";

export const Route = createFileRoute("/")({
  head: () => {
    const t = (k: string) => i18n.t(k);
    return {
      meta: [
        { title: t("landing.metaTitle") },
        { name: "description", content: t("landing.metaDescription") },
        { property: "og:title", content: t("landing.ogTitle") },
        { property: "og:description", content: t("landing.ogDescription") },
        { property: "og:url", content: `${SITE_URL}/` },
        { property: "og:type", content: "website" },
        { property: "og:image", content: OG_IMAGE },
        { name: "twitter:title", content: t("landing.ogTitle") },
        { name: "twitter:description", content: t("landing.ogDescription") },
        { name: "twitter:image", content: OG_IMAGE },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/` }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                name: "Konkouré",
                url: `${SITE_URL}/`,
                logo: `${SITE_URL}/favicon.png`,
              },
              { "@type": "WebSite", name: "Konkouré", url: `${SITE_URL}/` },
            ],
          }),
        },
      ],
    };
  },
  component: Landing,
});

function Landing() {
  const status = useLandingSessionGuard();

  if (status === "checking") return <SplashScreen />;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <HeroSection />
        <TrustBandSection />
        <BenefitsSection />
        <ModulesSection />
        <GeoAttendanceSection />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <SiteFooter />
    </div>
  );
}
