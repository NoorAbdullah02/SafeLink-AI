# Development phases and architecture decisions

## Phase 1: runnable core

React/Vite UI, Express API, shared contracts, Drizzle schema and migration, scrypt-based authentication, opaque sessions, URL/message rules, explainable results and redacted scan history. Validation includes end-to-end account/history/authorization tests and production web compilation.

## Phase 2: content and mobile

Flutter client shares the same API. QR images decode with jsQR; the native camera decodes QR content before server analysis. Sharp validates/normalizes images; Tesseract extracts actual English/Bangla text. Brevo handles account and alert templates. Reports are deduplicated and reviewed.

## Phase 3: evidence and family features

Optional Safe Browsing and AI provider adapter, configurable brand records, simple mode, contacts, account dashboard and administrator moderation. Risk evidence remains separate from AI explanation. Empty charts reflect zero actual activity.

## Phase 4: handoff

Controlled QR/OCR assets, Android share channel, lightweight report relationship view, responsive layouts, CI, Docker deployment, test records and documentation. GitHub push and live credentials remain with the owner.

## Schema choices

Ten PostgreSQL tables use UUIDs, foreign keys, timestamps and uniqueness/indexes. A scan result and its evidence are stored as one redacted JSONB document in `scans`, avoiding partial result/evidence writes. Brand official domains and aliases are JSONB arrays in a configurable brand row. Sessions and short-lived action tokens are separate tables. Reports are uniquely constrained per account and normalized entity. Status/role values are validated at the API boundary; do not mutate them through untrusted SQL clients.

The development-only `MemoryStore` is explicitly selected, volatile and forbidden without a production database. It executes the same application and detection logic and is used for deterministic integration tests. There are no canned scan responses.
