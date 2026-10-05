# SafeLink AI

Before you click, take a second look.

SafeLink checks URLs, Bangla/Banglish/English messages, QR images and screenshots for scam indicators. The React website and Flutter app use the same Express backend. Results show evidence, a 0–100 risk indicator and which checks actually ran. A low score does not prove safety.

## Features and limits

- URL structure and brand look-alike rules, credential/payment/urgency rules, QR decoding and English/Bengali OCR.
- Account login, redacted private history, saved scans, community reports and administrator moderation.
- Trusted contacts and explicitly requested email alerts when email services and account verification are available.
- Optional external language-model and Google Safe Browsing checks, requiring user opt-in. The safety assistant uses curated guidance by default and separately offers external AI.
- Responsive website and Flutter camera, gallery and Android shared-text integration in source.

Scans run on the backend. Submitted content reaches your SafeLink server even when external providers are disabled. Raw messages, screenshot text, extracted phone numbers and AI free text are excluded from saved history; stored URLs are reduced to origins. A domain itself can still be identifying, and redaction cannot recognize every secret in free text. Review content before submitting or exporting it.

SafeLink does not open scanned destinations, follow redirects, block financial accounts, recover money, file police complaints or certify websites. Complaint drafts need the user's review and submission. A decoded QR cannot establish payment safety.

## Architecture

| Part            | Implementation                                                  |
| --------------- | --------------------------------------------------------------- |
| Website         | React, TypeScript, Vite, Tailwind, Radix UI                     |
| Mobile          | Flutter/Dart, Mobile Scanner, Image Picker, Secure Storage      |
| API             | Node.js, Express, Zod, session cookies and mobile bearer tokens |
| Detection       | Rules, jsQR, Sharp, Tesseract; optional provider adapters       |
| Persistent data | PostgreSQL/Neon, Drizzle and included migrations                |
| Optional email  | Brevo HTTPS API                                                 |

AI is configured through `LLM_BASE_URL`, `LLM_API_KEY` and `LLM_MODEL`. It adds optional interpretation; the project does not contain a trained scam classifier or measured detection accuracy. Google Safe Browsing needs its own key. Missing or failed providers appear as unavailable.

## Local setup

Use Node.js 22.12+ and pnpm 10+. Run `pnpm install --frozen-lockfile`, copy `.env.example` to `.env`, then run `pnpm dev`. Open `http://localhost:5173`. Windows users can use `scripts/start-local.ps1`. The development proxy expects API port 3001.

The example configuration explicitly uses `DEMO_MEMORY=true`: accounts/history reset on restart. For persistent data, configure `DATABASE_URL`, set `DEMO_MEMORY=false` and run `pnpm db:migrate`. Keep production accounts separate from testing. Optional provider keys can remain empty.

For screenshot demos, run `pnpm ocr:prepare` and set `OCR_LANG_PATH` to the printed directory. Container builds include OCR language files to avoid a first-use download on the demo connection.

## Checks and builds

```sh
pnpm test
pnpm build
pnpm audit
pnpm demo:verify
```

The local audit completed on 5 October 2026. All 73 website/API tests (64 backend and nine React DOM regressions) and 39 Flutter tests passed, Flutter analysis found no issues, the production build passed and the full dependency audit reported zero known advisories. Browser checks covered account/scan/history flows, keyboard navigation, responsive layouts and isolated family/community/admin fixtures. Flutter tests include core pages and Message demo cards at 320 logical pixels with 180% text scaling.

Software tests do not measure real-world scam detection accuracy. Current results and remaining checks are in [the audit](docs/AUDIT-2026-10-04.md) and [validation record](docs/VALIDATION.md), with final [desktop](docs/qa/final-desktop.png) and [phone](docs/qa/final-phone.png) screenshots.

```sh
cd mobile
flutter pub get
flutter analyze
flutter test
flutter build apk --debug --dart-define=API_URL=https://your-safelink-host
```

On 5 October 2026, the audited source was pushed to `codex/safelink-audit` and opened as [draft PR #1](https://github.com/NoorAbdullah02/SafeLink-AI/pull/1); `master` remains unchanged. The [successful GitHub Actions run](https://github.com/NoorAbdullah02/SafeLink-AI/actions/runs/37300673707) passed both `web-api` and `flutter` jobs, including Flutter analysis/tests, debug APK compilation, signature verification and checksum artifact generation. Download **SafeLink-AI-debug-apk** from that run. Its APK was built from source `3d20ae5` (`3d20ae59f2bdd6aa6db5a53da888592351441d68`); later documentation changes are not part of that artifact. Local verification passed: the downloaded archive digest matched GitHub, the extracted APK matched its SHA-256 file, and `apksigner` accepted its v2 debug signature (exit 0). No physical-device installation was performed.

See [the mobile README](mobile/README.md) for phone connectivity and signing, and [the Android build record](docs/ANDROID-BUILD.md) for both build environments. The earlier Windows attempt was blocked by Application Control at `impellerc.exe`, produced no local APK and changed no security settings. The Linux CI build succeeded. No authorized Android device was connected for acceptance testing.

CI uploads a test APK rather than overwriting a fixed public release tag. Public releases require the owner's signing configuration and an explicitly reviewed release.

## Competition and deployment

Use [the competition demo guide](docs/COMPETITION-DEMO.md) for controlled inputs, presentation and judge questions, and [deployment instructions](docs/DEPLOYMENT.md) for hosting/release steps.

Read-only checks passed for Neon connectivity and the expected columns of all ten tables, without reading personal rows or writing data. Brevo returned HTTP 200 with an active configured sender; no email was sent. Mistral returned HTTP 401 and needs the owner's provider/key correction and a new check. Google Safe Browsing is not configured. Real email delivery and external-model quality remain unverified.

The repository previously listed [a Render website](https://safelink-ai-8q6c.onrender.com) and [an Android release](https://github.com/NoorAbdullah02/SafeLink-AI/releases/tag/v1.0.0). Those are separately published versions. A later read-only Render health request returned HTTP 200 with PostgreSQL/email/AI configured and intelligence off; this reports configuration and does not prove the fixes are deployed or those providers work. The audited branch is pushed and CI has passed, but the draft PR is unmerged and deployment of the fixes remains pending. The cloud debug APK is a test artifact, not an updated public release.

Owner repository: [NoorAbdullah02/SafeLink-AI](https://github.com/NoorAbdullah02/SafeLink-AI).
