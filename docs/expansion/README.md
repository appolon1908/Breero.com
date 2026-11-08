# BREERO — 35 services × 4-country geographic rollout (draft)
**Date:** 2026-11-08
**Repository:** appolon1908/Breero.com
**Status:** Proposed public informational directory implementation on a feature branch. Not merged, deployed, or verified live.

## Deliverables in this branch
- `docs/expansion/service-catalog.v1.json`: exactly 35 proposed customer-facing service categories with English and Spanish names, provider-vetting and local regulatory review flags. Every proposal has `bookingEnabled:false` and `landingPageEnabled:false`.
- `docs/expansion/market-targets.v1.json`: 4 countries, 134 top-level administrative units and 503 priority city/locality targets. Every region has `status:"research_only"`.

### Country scopes
| Country | Admin coverage | Priority city/locality entries | Locale | Currency |
| --- | ---: | ---: | --- | --- |
| United States | 50 states + Washington, DC = 51 | 234 | en-US, es-US | USD |
| Mexico | 32 federal entities | 110 | es-MX | MXN |
| Spain | 17 autonomous communities + Ceuta and Melilla = 19 | 78 | es-ES | EUR |
| Dominican Republic | 31 provinces + Distrito Nacional = 32 | 81 | es-DO | DOP |
| **Total** | **134** | **503** | | |

The priority city list is not an exhaustive national municipality list. Metro localities may be named without having independent municipality status (e.g., Punta Cana and Bávaro); use authoritative place identifiers, coordinates, boundaries and administrative mappings before production. The Dominican Republic's numeric subregion codes in this planning file are placeholders, not official geocodes. Deduplicate cities sharing metropolitan service zones.

## Public directory page implementation
- `apps/web/content/services.ts`: defines 35 marketing service pages (23 added on this branch), with new categories informational and **without** booking service IDs.
- `apps/web/content/expansion-market-targets.json` and `apps/web/content/locations.ts`: generate 503 globally accessible city directory slugs. Each city has a seven-verified-professional **minimum policy**, not an asserted provider count.
- `apps/web/app/locations/page.tsx` and `apps/web/app/locations/[slug]/page.tsx`: location index and informational city pages; each unverified city returns `robots.index:false`, with no service-availability promise.
- `apps/web/content/public-routes.json`: includes all 35 service pages, maintaining existing page sitemap behavior.
- `docs/expansion/marketing-creative-matrix.md`: B2C, B2B commercial buyers, and B2B pro recruitment campaign direction for 35 categories.
- Public visibility differs from operational availability: directory pages can be reachable without approval for bookings, provider matches, memberships or ads.

## First-wave target clusters (research, not open markets)
- **United States:** existing FL / TX / MA 13-city pilot first; then NYC, Los Angeles, Chicago, Dallas/Fort Worth, Phoenix, Atlanta, Philadelphia, Charlotte, Seattle and other metro markets once coverage is proven.
- **Mexico:** Ciudad de México, Monterrey metropolitan area, Guadalajara metropolitan area, Puebla, Tijuana, Cancún/Playa del Carmen, Mérida, Querétaro and León.
- **Spain:** Madrid, Barcelona, Valencia, Sevilla, Málaga, Zaragoza, Alicante/Elche, Bilbao, Murcia and Palma.
- **Dominican Republic:** Distrito Nacional / Gran Santo Domingo, Santiago de los Caballeros, Higüey/Punta Cana, La Romana, San Pedro de Macorís, San Cristóbal, Puerto Plata, La Vega and San Francisco de Macorís.

## Existing product behavior (verified in source at planning time)
- `apps/web/content/services.ts` has 12 marketing service definitions and 20 intake choices; expansion metadata is intentionally separate so it cannot silently replace the live authority.
- `apps/web/content/locations.ts` has zero published markets; location pages filter by `published`.
- A service's absence of `bookingServiceId` already triggers an informational availability warning in the web template.
- This branch adds informational web marketing pages and public route definitions; it does **not** change canonical backend catalog, booking, payments or provider state. International cities are not declared serviceable.

## Execution and gates
1. **Authority & product taxonomy:** reconcile this proposal against canonical API/service DB and separately published BREERO Pro capabilities; HVAC is one provider umbrella trade and *Heating* / *Cooling* are distinct customer search intents, not duplicate provider entities.
2. **Geography:** verify country/state/province codes and authoritative city/municipality IDs; record geofenced service zones separately from marketing locations; avoid 35 × 503 copy-paste SEO doorway pages.
3. **Eligibility:** for each country × city × service, require vetted local providers and authorized coverage radius, service capabilities, licenses, insurance where applicable, work hours and at least one dispatch/lead acceptance path.
4. **Compliance:** local counsel/operations review for contracts, marketplace role, privacy, cookie/analytics consent, telemarketing, WhatsApp/SMS/email, consumer protections, taxes, currency and local provider licensing. Public business phone numbers do not create marketing opt-in.
5. **Internationalization:** localized terms, service descriptions, support flows, phone input, timezones, locale-specific money formats (USD/MXN/EUR/DOP), safe address schemas and privacy notices.
6. **CRM isolation:** restrict all tags/fields/workflows to BREERO's own HighLevel location. Separate homeowner B2C requests, B2B provider recruitment, and service fulfillment providers. Segment by country/region/city/trade/actual language; do not guess language from location or enable promotional automations from scraped records.
7. **SEO:** one canonical indexable page per distinct, genuinely serviceable intent/market; localized canonical/hreflang; unpublished or unverified pages remain noindex/404. No false “available now” claims.
8. **Feature-gated rollout:** import the catalog to staging, test deterministic provider matching and consent gates, run jurisdiction-specific acceptance checks, then approve individual market/service pairs with audit history.
9. **Monitoring:** track verified providers, inbound requests, accepted jobs, provider response SLA, revenue, response language, suppression/consent, customer complaints and net serviceability per market.

## Operational record per market–service pair
`country_iso2`, `admin_region_id`, `city_place_id`, `service_slug`, `language`, `currency`, `provider_verification_count`, `legal_review_status`, `provider_capacity`, `coverage_polygon`, `source_evidence`, `consent_policy_version`, `owner`, `approved_at`, `launch_status`.

**State machine:** `research_only` → `provider_qualification` → `operational_review` → `approved` → `published`; anything not published must remain absent from live bookings and paid campaigns. Rollback must disable immediately without deleting evidence.

## Explicit non-goals of this PR
No claim that the 35 categories are operationally bookable, no bulk import of unverified contractors, no global automatic launch, no ads or outbound communication, no activation of subscriptions/payments, no change to the existing FL/TX/MA live operations.
