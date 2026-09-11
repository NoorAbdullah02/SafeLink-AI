# Validation record

Validated locally on Windows on 2026-09-10. These results describe the implementation, not statistical detection accuracy.

| Check | Result |
|---|---|
| TypeScript type checking | Passed |
| React/Vite production build | Passed |
| Express production bundle | Passed |
| Web/API automated tests | 21 passed (rules, auth, privacy, authorization, QR and provider/database fallback) |
| Real QR images | Decoded reserved test URL and non-URL text correctly |
| Real OCR image | Extracted the controlled Banglish message and URL from actual pixels |
| PostgreSQL SQL migration generation | Passed; migration file included |
| Live Neon migration/persistence | Not tested: DATABASE_URL not supplied |
| Live Brevo delivery | Not tested: API key and verified sender not supplied |
| Live AI/Safe Browsing providers | Not tested: credentials not supplied; absence/failure behavior tested |
| Browser scan flow | Controlled sample returned Critical Risk with five local evidence items |
| Website widths | Checked at 320/390/768/1440 px; no horizontal document overflow |
| Flutter SDK | 3.47.3 / Dart 3.13.3 |
| Flutter analysis | Passed with no issues |
| Flutter UI tests | 4 passed, including widths 320/768/1440 px and authenticated-history gating |
| Android bundle/APK build | Blocked: Android SDK is not installed in this environment |
| iOS build | Not run: requires macOS/Xcode and signing |
| Physical camera/gallery/share intent | Requires Android/iOS device acceptance test |
| Safari/Firefox/Edge device coverage | Not exhaustively tested; responsive standards-based implementation |
| Public deployment / GitHub push | Not performed; owner will push and configure hosting |

The first Flutter 320 px test found an overflow. The header and segmented control were adjusted, and all width tests then passed. Core API tests use explicitly selected volatile storage; this does not establish that a live Neon configuration has been validated.

The source includes Android and iOS platform projects. Release signing intentionally requires the owner's keystore; the project does not silently sign a release with a debug key.

## Follow-up quality audit — 2026-09-10
- Production TypeScript, Vite and server build passed after final fixes.
- Node API/engine/media/provider suite: 26 passed, 0 failed.
- Flutter analyze: no issues. Flutter widget suite: 4 passed.
- Browser scanner/result checked at widths 320, 390, 768 and 1440: no horizontal document overflow. Mobile results scroll into view after scanning.
- Dark-theme canvas/navigation contrast corrected and visually rechecked in the updated preview.
- Fixed invalid URL responses (400), domain/port validation, word-fragment false positives, mixed safety-advice/credential requests, admin missing-resource responses, session revocation on disable, reset-token invalidation, scan selection keep-state, history loading/no-matches/retry, and network timeout messages.
- These checks do not certify universal device compatibility or detection accuracy. Live Neon, Brevo, AI/threat services, production deployment, Android release build and physical Android/iOS testing remain outstanding as documented above.

Origin follow-up: local preview ports 5173/5174 now share the CORS and write-origin allowlist in development only. Production accepts only APP_URL's origin. 28 automated tests pass; build passes; the user's previously blocked sample scan completed successfully in the browser on localhost:5174.

Dark palette follow-up: corrected navigation badge contrast, subtle labels, risk/error surfaces, input placeholders, accent links and primary button contrast. Browser checked dark scanner and sign-in dialog and reload persistence. Production build passes.

Landing page: added responsive editorial hero, illustrative scan card, four scan features, workflow and clear risk limitations. Home opens landing; #workspace opens tools; account-action URLs bypass landing. Browser checked desktop 1440 and mobile 390/320, both themes, and Start checking navigation. No horizontal overflow at tested widths. Production build passes.

Shared palette: landing and workspace now use common background, surface, text, muted, border and brand-button tokens. Browser confirmed identical background/button RGB values in light and dark modes. Risk-status colors retain semantic distinctions. Production build passes.

Authentication visual refresh: branded split-panel desktop dialog, responsive single-column mobile forms, account mode switch, show/hide password, length guidance and guest entry. Browser verified desktop login, mobile registration, password visibility and no horizontal dialog overflow at 390px. Build passes. Backend authentication unchanged.

## Full follow-up audit — 2026-09-11
- 29 Node API/engine/media/provider tests pass. Added profile updates, contacts isolation, verification gates and login coverage.
- Flutter analyze passes; all 4 Flutter widget tests pass.
- Final production build passes.
- Browser: temporary QA registration, authenticated scan, keep scan, history persistence, no-match search, dashboard totals, opening historical results, immediate Unsave badge updates, settings reachability and logout exercised.
- Found and fixed: recent dashboard results were not interactive; history keep badges did not rerender immediately; fixed sidebar did not scroll on short screens, making account/settings inaccessible.
- Restored the stopped Vite preview server after browser registration reported a network failure.
- This is a scoped development audit, not a universal correctness claim. Live Neon persistence/migrations, actual email delivery/reset flow, external AI/threat services, production deployment, native APK/iOS builds and physical-device compatibility still require configured environments. OCR was verified previously; not rerun in this audit. Detection accuracy is not measured by these software tests.
