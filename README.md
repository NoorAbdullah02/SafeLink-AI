# SafeLink AI

**Before You Click, Let AI Check.**

A web + Flutter cyber-safety project that analyzes links, Bangla/Banglish/English messages, real QR images and screenshots. React and Flutter use one Express API and the same risk engine. Persistent storage uses Neon PostgreSQL with Drizzle.

## What is included

- Responsive React/Vite/TypeScript dashboard with Tailwind and ShadCN-style Radix-based controls; light/dark themes.
- Real URL parsing, message rules, configurable brand look-alike checks, evidence and 0–100 risk scores.
- Optional Google Safe Browsing and configurable OpenAI-compatible language analysis, with explicit failure states.
- Real QR decoding, English/Bangla OCR, extracted-text review and controlled demo assets.
- Password authentication, cookie sessions for web, opaque bearer sessions for mobile, email verification and reset.
- Private scan history, kept scans, community reports and moderation, contacts, Brevo email alerts and admin audit logs.
- Personal dashboard and a lightweight entity-to-category relationship graph based on actual reports.
- Flutter scanner, QR camera, image upload, history, Family Shield and Android share-to-SafeLink.
- SQL migration, CI workflow, Docker deployment, example environment configuration and automated tests.

## Quick start

Install **Node.js 22.12+** and **pnpm 10**. From this folder:

```sh
pnpm install
cp .env.example .env
pnpm dev
```

On Windows, use `Copy-Item .env.example .env` instead of `cp` if needed. Open `http://localhost:5173`. The API is on port 3001. The default `.env.example` explicitly enables **temporary memory mode** for local demonstrations: all results are computed by the normal risk engine, but accounts and activity disappear on restart. It is not a replacement database, and production refuses to start without `DATABASE_URL`.

### Neon PostgreSQL

1. Create a Neon database and copy its connection string into `.env` as `DATABASE_URL`.
2. Set `DEMO_MEMORY=false`.
3. Run `pnpm db:migrate` to apply the included SQL migration.
4. Run `pnpm dev` and register an account.
5. To provision a trusted administrator from the deployment shell, run `pnpm admin your-email@example.com`.

Never commit `.env` or paste keys into frontend code. The administrator command is a deployment-owner operation, not a public endpoint.

### Production build

```sh
pnpm test
pnpm build
NODE_ENV=production pnpm start
```

PowerShell: `$env:NODE_ENV='production'; pnpm start`. In production, Express serves both the built website and API on the same origin. Set `APP_URL` to the exact public HTTPS origin. Use `TRUST_PROXY_HOPS=1` only when there is exactly one trusted reverse proxy.

### Flutter

The `mobile/` folder is the Flutter application. Install the stable Flutter SDK and Android SDK, then:

```sh
cd mobile
flutter pub get
flutter analyze
flutter test
flutter run --dart-define=API_URL=http://10.0.2.2:3001
```

`10.0.2.2` is the Android emulator’s host bridge. For a physical phone, use the development computer’s LAN address, run the API on the same network, and allow that port through the firewall. Release builds must use your HTTPS production URL:

```sh
flutter build apk --release --dart-define=API_URL=https://YOUR-DEPLOYED-HOST
flutter build appbundle --release --dart-define=API_URL=https://YOUR-DEPLOYED-HOST
```

Configure your own release signing key before publishing. iOS builds require macOS, Xcode and Apple signing. Camera permission descriptions are included. Android accepts shared text/URLs through a small native method channel; iOS Share Extension is not included. iOS users can paste text or upload images. The website remains the browser-based option for desktop devices.

## Architecture

```text
React website ─┐
              ├── Express REST API ─── Neon PostgreSQL / Drizzle
Flutter app ──┘          │
                        ├── Deterministic risk engine
                        ├── Approved community reports
                        ├── Optional Google Safe Browsing
                        ├── Optional language-model provider
                        ├── QR decoder / English + Bangla OCR
                        └── Brevo HTTPS email API
```

Detection is never duplicated in clients. Submitted destinations are **never fetched**, executed or opened automatically. This avoids a scan endpoint becoming an SSRF proxy. Redirect destinations, downloaded files and live page contents are not inspected.

## Risk methodology

Local evidence has documented weights in `server/engine.ts`. Each rule ID contributes at most once per scan. Weak URL characteristics have low weights; credential requests and brand look-alikes have higher weights. Reviewed community evidence requires at least two distinct reporters and contributes at most 25 points. A threat-list match establishes a floor of 80. Optional AI semantic interpretation adds at most 20. The final value is clamped to 0–100.

| Score | Level |
|---|---|
| 0–24 | Low Risk |
| 25–49 | Caution |
| 50–74 | High Risk |
| 75–100 | Critical Risk |

The score is an **uncalibrated heuristic risk index**, not a percentage probability. A low score does not establish safety. The engine cannot reliably identify every Bangla/Banglish spelling, sophisticated impersonation, sarcasm or negation. Brand similarity can produce false positives. Internationalized domains and unusual suffixes can be legitimate.

Local/community/intelligence evidence is separate from AI interpretation. The UI lists unavailable or skipped checks, so missing APIs never appear as clean results. The sum of displayed rule weights may differ from the final score because of the intelligence floor, AI contribution and 100-point cap.

## External services

- **Brevo**: configure API key and verified sender address. Calls use the transactional HTTPS endpoint, not SMTP transport. Registration works without Brevo; verification, password resets and alerts explicitly remain unavailable. Verified email is required for sending alerts and production community reports.
- **AI**: set `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`. The adapter expects Chat Completions plus JSON-object response support. Other protocols require another `AIProvider` implementation. Provider output is validated. No provider result is fabricated.
- **Threat intelligence**: set `SAFE_BROWSING_API_KEY`; enable external checks in the scan form. Review Google’s terms before commercial use; Safe Browsing is intended for non-commercial use and Web Risk is the commercial alternative.
- **OCR**: Tesseract loads `eng` and `ben` language data. Set `OCR_LANG_PATH` to a prepared local directory for a disconnected demo. QR decoding does not require an external API. First-time language loading needs a network connection unless data is already prepared.

Run `pnpm ocr:prepare` while online, then set `OCR_LANG_PATH=work/ocr-data` for the local fair demo. Language data is excluded from Git and can be prepared again on another computer.

## Security and privacy

Passwords use salted Node scrypt. Session and reset tokens are cryptographically random; only hashes are stored. Web cookies are HttpOnly, SameSite=Lax and Secure in production. Mobile tokens use platform secure storage. Reset links are short-lived and atomically single-use in PostgreSQL. Resetting a password revokes existing sessions.

Zod validates input; Helmet supplies security headers; origin checks protect cookie-based mutations; rate limits cover API, authentication, scanning and email. Authorization is enforced server-side for every personal record and administrator route. Reports have a database uniqueness constraint per user/entity. Only approved reports count, and distinct reporters are deduplicated across matching entities.

Images are limited to 5 MB and 12 million pixels, decoded with Sharp, and held in memory only. Two concurrent image operations per API process are permitted. OCR can be imperfect: users see the actual extracted text. No image files are persisted by the API.

History omits raw message/OCR text, extracted phone numbers and URL queries/fragments. Paths, domains, evidence and AI interpretations may still contain identifying information; do not scan secrets. External AI redaction is best-effort and cannot guarantee removal of personal data. The external-check toggle is explicit consent to send the submitted content to configured providers.

Unkept scans expire after `RETENTION_DAYS` (default 30); a cleanup runs hourly. Kept scans remain until deleted. Community reports, contact details, alerts and audit records remain for account/moderation purposes. Expired sessions and action tokens are removed. Define your institution’s retention and account-removal procedure before public use.

The included rate limiter and OCR concurrency cap are per-process. Deploy as **one instance** for the initial Tech Fair/pilot. A larger deployment needs shared rate limiting, bounded database pagination, job-based OCR, monitoring, security review and abuse-response procedures.

## Tech Fair demo

1. Start the API and website before the fair. Check `/api/health`.
2. Use **Demo lab → Banglish account warning**, then Scan Now. Discuss the domain mismatch and PIN request evidence.
3. Try the neutral Bangla message. Explain why low risk is not a guarantee.
4. Upload `demo-assets/controlled-qr.png` in QR mode, or point Flutter’s camera at it.
5. Upload `demo-assets/controlled-message.png` in Screenshot mode. Expand extracted text to show genuine OCR.
6. Sign in, run scans, then show real history and dashboard counts.
7. With Neon/Brevo configured, demonstrate reports, administrator review and a user-triggered alert to an agreed test recipient.
8. Disable external checks or leave providers unconfigured; local analysis still works and the check list explains what was skipped.

Reserved `.example` domains are used for controlled inputs. They receive normal analysis rather than predefined responses. No real malicious links are needed.

**Offline contingency:** provider outage is different from total internet loss. The normal hosted API and Neon need internet. For an isolated fair laptop, run the local API with explicit temporary memory mode and preload OCR languages. Do not represent temporary storage as Neon persistence.

## Testing

```sh
pnpm test
pnpm typecheck
pnpm build
```

Tests cover URL parsing, unsafe schemes, credential and language rules, score bounds, distinct reviewed reports, account flows, authorization, session logout, single-use reset tokens, upload rejection and real QR decoding. `docs/VALIDATION.md` records the checks actually performed in this environment and the unverified integrations. Do not interpret a passing test suite as measured scam-detection accuracy.

See [API reference](docs/API.md), [deployment guide](docs/DEPLOYMENT.md), [validation record](docs/VALIDATION.md) and [development phases](docs/PLAN.md).

## Reference documentation

- [Vite](https://vite.dev/guide/)
- [Drizzle with Neon](https://orm.drizzle.team/docs/get-started/neon-new)
- [Brevo transactional email](https://developers.brevo.com/docs/send-a-transactional-email)
- [Google Safe Browsing lookup](https://developers.google.com/safe-browsing/v4/lookup-api)
- [Tesseract.js](https://github.com/naptha/tesseract.js)
- [Flutter mobile_scanner](https://pub.dev/packages/mobile_scanner)

## Screenshots

Add screenshots from your configured deployment before submitting the final university report. Suggested views: desktop scan center, mobile result, OCR extracted text and real activity dashboard. Avoid including private scan data.
