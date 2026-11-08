import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locationBySlug, locations } from "@/content/locations";
import { Hero } from "@/components/marketing/Hero";
import { ServiceGrid } from "@/components/marketing/ServiceGrid";
import { images } from "@/content/images";

export function generateStaticParams() {
  return locations.filter(location => location.published).map(location => ({ slug: location.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const location = locationBySlug(slug);
  if (!location || !location.published) {
    return { title: "Location not available", robots: { index: false } };
  }
  return {
    title: `Home-service directory for ${location.city}, ${location.region}`,
    description: location.description,
    alternates: { canonical: `/locations/${location.slug}` },
    // Accessible directory, not proof of local coverage or permission to index.
    robots: { index: false, follow: true },
  };
}

export default async function LocationDirectoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const location = locationBySlug(slug);
  if (!location || !location.published) notFound();
  return (
    <>
      <Hero
        compact
        eyebrow={`BREERO market directory · ${location.country}`}
        title={`Home-service information for ${location.city}.`}
        description={location.description}
        image={images.homeHero}
      />
      <section className="mk-section">
        <div className="mk-container">
          <header className="mk-heading">
            <p className="mk-eyebrow">Market coverage review</p>
            <h2>Local availability has not yet been confirmed.</h2>
            <p>
              BREERO requires at least {location.minimumVerifiedProfessionals} independently
              verified and eligible professional businesses per city before declaring operational
              coverage. This city's provider count is not yet verified. Each offered service
              also requires qualified local coverage before bookings are enabled.
              This directory is informational only.
            </p>
          </header>
          <h2>Explore home-service categories</h2>
          <p>Learn about service types without assuming availability in {location.city}.</p>
          <ServiceGrid limit={6} />
          <p><Link href="/services">See all 35 service categories</Link></p>
          <p><Link href="/locations">Explore other BREERO markets</Link></p>
        </div>
      </section>
    </>
  );
}
