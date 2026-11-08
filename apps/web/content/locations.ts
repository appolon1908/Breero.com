import marketTargets from "./expansion-market-targets.json";

export type LocationContent = {
  slug: string;
  name: string;
  city: string;
  region: string;
  regionCode: string;
  country: string;
  countryCode: string;
  published: boolean;
  verifiedProfessionals: number | null;
  minimumVerifiedProfessionals: number;
  description: string;
};

/** Research directory publication is different from operational service availability. */
const slugify = (value: string) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

export const locations: LocationContent[] = marketTargets.countries.flatMap(country =>
  country.regions.flatMap(region =>
    region.priorityCities.map(city => ({
      slug: `${country.iso2.toLowerCase()}-${region.code.toLowerCase()}-${slugify(city)}`,
      name: city,
      city,
      region: region.name,
      regionCode: region.code,
      country: country.name,
      countryCode: country.iso2,
      published: true, // Informational market-directory page only; NOT a booking authorization.
      verifiedProfessionals: null, // Unknown until audited; never invent provider counts.
      minimumVerifiedProfessionals: marketTargets.minimumVerifiedProfessionalsPerCity,
      description: `Explore BREERO home-service categories for ${city}, ${region.name}, ${country.name}. Local provider coverage is not yet confirmed. Requests and bookings require independent verification of professional availability.`,
    }))
  )
);

export const locationBySlug = (slug: string) => locations.find(location => location.slug === slug);
