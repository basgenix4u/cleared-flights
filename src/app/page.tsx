import { Hero } from "@/components/home/Hero";
import { FaqSection, Inspiration } from "@/components/home/Interactive";
import { DestinationMosaic, FinalCta, PriceAnatomy, Principles, RoutesTable, Trust } from "@/components/home/Sections";
import { BRAND } from "@/lib/config";
import { FAQS } from "@/lib/faq";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function HomePage() {
  const ld = [
    { "@context": "https://schema.org", "@type": "Organization", name: BRAND.name, url: site, email: BRAND.supportEmail },
    { "@context": "https://schema.org", "@type": "WebSite", name: BRAND.name, url: site },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];
  return (
    <>
      <Hero />
      <PriceAnatomy />
      <RoutesTable />
      <DestinationMosaic />
      <Principles />
      <Trust />
      <Inspiration />
      <FaqSection />
      <FinalCta />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </>
  );
}
