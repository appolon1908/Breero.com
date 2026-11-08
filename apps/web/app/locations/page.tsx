import type { Metadata } from "next";
import Link from "next/link";
import { locations } from "@/content/locations";
import { images } from "@/content/images";
import { Hero } from "@/components/marketing/Hero";

export const metadata: Metadata = {
  title: "International home-service market directory",
  description: "Explore BREERO's planned service-area directories in the United States, Mexico, Spain and the Dominican Republic. Availability must be confirmed before booking.",
  alternates: { canonical: "/locations" },
};

const countries = [
  { code: "US", name: "United States" },
  { code: "MX", name: "Mexico" },
  { code: "ES", name: "Spain" },
  { code: "DO", name: "Dominican Republic" },
];

export default function LocationsPage() {
  return (
    <>
      <Hero
        compact
        eyebrow="BREERO worldwide"
        title="Explore home-service markets."
        description="Browse city directories across four countries. These are informational pages; a directory listing does not mean professional coverage has been approved."
        image={images.homeHero}
      />
      <section className="mk-section">
        <div className="mk-container">
          <header className="mk-heading">
            <p className="mk-eyebrow">Geographic directory</p>
            <h2>503 priority city and locality directories</h2>
            <p>
              Each city needs at least seven independently verified professional businesses,
              plus qualified coverage for each offered service, before BREERO can activate
              service matching or bookings. Until then, city pages remain informational.
            </p>
          </header>
          {countries.map(country => {
            const entries = locations.filter(location => location.countryCode === country.code);
            const regionNames = Array.from(new Set(entries.map(location => location.region)));
            return (
              <section key={country.code} aria-label={country.name}>
                <h2>{country.name} — {entries.length} directory locations</h2>
                {regionNames.map(region => {
                  const cities = entries.filter(location => location.region === region);
                  return (
                    <details key={`${country.code}-${region}`}>
                      <summary>{region} ({cities.length})</summary>
                      <ul>
                        {cities.map(location => (
                          <li key={location.slug}>
                            <Link href={`/locations/${location.slug}`}>{location.city}</Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                })}
              </section>
            );
          })}
          <p><Link href="/services">Explore all 35 service categories</Link></p>
        </div>
      </section>
    </>
  );
}
