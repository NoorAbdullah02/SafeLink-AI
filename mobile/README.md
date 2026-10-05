# SafeLink AI mobile

Flutter Android/iOS client for the shared SafeLink Express API. Includes text and URL scans, QR camera, screenshot upload, secure sessions, private history, simple mode, contacts and explicit email alerts. Android accepts shared text through `safelink/share`.

The safety assistant defaults to local guidance. Its separate external AI switch explicitly shares the question and recent conversation with the configured provider; each reply identifies local guidance, external AI, or a provider attempt followed by local guidance. The awareness page contains educational patterns, not national statistics. Scan checks and email delivery records come from API responses. There is no background push notification service or automatic account freeze.

Run `flutter pub get`, `flutter analyze`, `flutter test`, then `flutter run --dart-define=API_URL=http://10.0.2.2:3001` for an Android emulator. A physical phone needs the host computer's LAN address or deployed HTTPS endpoint.

Debug Android builds permit local HTTP. Release builds require HTTPS and `android/key.properties` with your private signing key; see `android/key.properties.example`. iOS requires macOS/Xcode and your signing team. Camera and photo permission descriptions are included. iOS Share Extension is not implemented; paste and gallery upload remain available.

Changing the server clears the current session so bearer credentials cannot be sent to another endpoint. Sessions created before endpoint binding was added require a fresh sign-in. Local sign-out still clears stored credentials if the server is unavailable. Android hotline actions open the dialer; platforms without that integration copy the number. The saved support directory can be read offline; scans require the server. Clipboard suggestions are off by default and can be enabled under Account.

The mobile UI currently uses its light theme even when the device uses dark mode. System text scaling remains enabled. Automated tests cover core pages and Message demo cards at 320 logical pixels with 180% text scaling; assistive technology and physical-device font behaviour still need QA.

Local verification completed on 5 October 2026: Flutter 3.47.3/Dart 3.13.3; analysis passed with no issues and all 39 tests passed (20 API, 19 widget). Tests include stale-session/server binding, interrupted-gallery recovery, pending input locks, scanner widths of 320, 768 and 1440 logical pixels, simulated system dark mode and the large-text layout cases above. Follow-up cases cover dismissed login, secure-storage failure, late image/dialog actions, assistant session expiry and malformed response fields, and auth/contact/server/assistant forms with keyboard at 180% text scale. These use isolated fixtures and do not establish real-device behaviour or detection accuracy.

On 5 October 2026, [GitHub Actions completed successfully](https://github.com/NoorAbdullah02/SafeLink-AI/actions/runs/37300673707) for source `3d20ae5` (`3d20ae59f2bdd6aa6db5a53da888592351441d68`). Both `web-api` and `flutter` jobs passed; the Flutter job analyzed/tested the source, built a debug APK, verified its signature and uploaded **SafeLink-AI-debug-apk** with a SHA-256 file. The artifact belongs to that source revision, not later documentation changes. Local verification passed: the downloaded archive digest matched GitHub, the extracted APK matched its SHA-256 file, and `apksigner` accepted its v2 debug signature (exit 0). No physical-device installation was performed.

The source is pushed to `codex/safelink-audit` in [draft PR #1](https://github.com/NoorAbdullah02/SafeLink-AI/pull/1). `master` remains unchanged and backend deployment remains pending. The APK uses the existing published API by default; a successful cloud build does not establish that the audited backend is deployed.

During the earlier local attempt, approved portable JDK/Android SDK/Gradle were installed under `work`. Windows Application Control blocked the official `impellerc.exe` compiler, so that attempt produced no local APK and changed no security settings. The Linux CI build subsequently succeeded. See [the Android build record](../docs/ANDROID-BUILD.md).

ADB found zero authorized devices. Installation, camera/gallery permissions, interrupted-gallery behaviour on a phone, share sheets, native dialer behaviour, keyboard, secure storage, release signing and physical-device checks remain unverified. iOS builds require macOS/Xcode and signing.

The website provides community moderation and the full dashboard. No detection rules run in this client: all scan results come from the backend.

See the [parent README](../README.md) and [validation record](../docs/VALIDATION.md) for setup, tests and deployment limitations.
