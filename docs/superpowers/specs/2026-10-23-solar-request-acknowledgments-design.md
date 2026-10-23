# Solar inquiries and transactional request acknowledgments

The user asked to add solar panels, improve the landing-page system, provide automatic email replies and scheduling, and start with the backend where appropriate. This first implementation slice extends the existing Breero backend; it does not create another business backend in Landing-Pages or Marketing Backend.

## Existing architecture and chosen approach

Use existing public service-request validation, consent, idempotency, PostgreSQL persistence and transactional outbox. Add a separate acknowledgment event and handler, independent of CRM delivery. Keep existing booking-intent/operator scheduling as the appointment authority. Reuse the open tenant-email foundation PR #70 rather than duplicate its mailbox provisioning APIs.

A browser email call would lose reliable acceptance/consent state; a new public arbitrary-send endpoint would permit misuse. Neither is appropriate. A durable server-generated acknowledgment is the chosen bounded implementation.

The current public intake has no company tenant column and auth uses fixed Breero context. This slice supports that canonical Breero context ONLY. Separate brand/site ownership and tenant-safe sender mappings must precede multi-brand email activation; do not infer ownership from source_url, UTM or user-supplied company names.

## Behavior

- Solar panel installation has canonical slug solar-panel-installation. Add it to the seed catalog as active for inquiries, non-bookable, quote-required and provider-approval-required, with no invented price or duration. Do not run the seed against any live database.
- For a newly accepted SERVICE_REQUEST with transactional contact and transactional email permission, enqueue one distinct public_submission_acknowledgement_requested event in the same transaction as the inquiry and existing CRM event.
- The acknowledgment aggregate type is public_submission_email, so its parking/delivery never changes the inquiry's CRM downstream_status.
- Store only the submission reference in the acknowledgment event. Fetch the current authoritative recipient/consent from the submission at delivery.
- Repeated/concurrent request acceptance must retain one inquiry, one CRM event and at most one acknowledgment event. Conflicting idempotency payloads remain 409.
- At delivery recheck submission kind, required permissions and active EMAIL/TRANSACTIONAL_EMAIL suppression. A withdrawn/suppressed/missing recipient fails terminally with a safe, non-PII reason and sends nothing. Marketing permission does not substitute for transactional permission.
- Add deterministic English and Spanish receipt templates. Normalize Spanish regional locale to Spanish, English/unknown to English. Include only the public request reference and truthful request-received language; no quote/payment/provider/appointment confirmation, arbitrary user text, address or tracking links.
- Reject automatic acknowledgment delivery after 24 hours from inquiry creation with an explicit expired diagnostic. Old parked receipts require a new reviewed follow-up rather than silent delivery.
- Route only this known event to the gated email adapter. Live delivery remains disabled by the existing settings and production release validator. Missing delivery configuration parks it for explicit authorized replay; middleware status does not control it.
- Pass a stable opaque idempotency key to the email adapter. Its approved downstream must honor deduplication before activation. Database enqueue is unique; external exactly-once delivery is not claimed.
- Record acknowledgment enqueue as a PII-free audit action. Existing API response and OpenAPI contract remain unchanged: HTTP 202 REQUEST_ACCEPTED does not promise email delivery or a booking.

## Scheduling and rollout

Existing booking intents support requested times and version/ownership checks; operator scheduling remains authoritative. Automated reminders/rescheduling, brand-scoped scheduling resources, confirmed-appointment events and a persisted follow-up policy are separate subsequent slices, documented in the project extension. No appointments or calendars are changed here.

Testing uses an isolated checkout, local virtual environment and disposable PostgreSQL/PostGIS/Redis only. Required review evidence includes applicable tests, formatting/types/contracts and the exact branch/head. Do not merge, deploy, activate email, apply live migrations or spend advertising money.
